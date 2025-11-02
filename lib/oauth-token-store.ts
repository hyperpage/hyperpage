import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { oauthTokens } from './database/schema';
import { eq, and, sql } from 'drizzle-orm';
import logger from './logger';

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt?: number; // milliseconds timestamp
  refreshExpiresAt?: number; // refresh token expiry
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

export interface StoredTokens extends OAuthTokens {
  id: number;
  userId: string;
  toolName: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Secure OAuth token storage with AES-256-GCM encryption
 */
export class SecureTokenStorage {
  private db: ReturnType<typeof drizzle>;
  private encryptionKey: string;

  constructor(databasePath: string = './data/hyperpage.db') {
    try {
      const sqlite = new Database(databasePath);
      this.db = drizzle(sqlite);

      // Initialize database if not exists
      this.initializeDatabase();

      // Get encryption key from environment
      const encryptionKey = process.env.OAUTH_ENCRYPTION_KEY;
      if (!encryptionKey || encryptionKey.length < 32) {
        throw new Error('OAUTH_ENCRYPTION_KEY must be at least 32 characters');
      }
      this.encryptionKey = encryptionKey;

      logger.info('Secure token storage initialized');
    } catch (error) {
      logger.error('Failed to initialize secure token storage:', error);
      throw error;
    }
  }

  /**
   * Initialize database tables
   */
  private async initializeDatabase() {
    // Tables are created by migrations in database/migrate.ts
    // This method ensures they're available
    logger.info('Database tables ready for token storage');
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  private encrypt(plaintext: string): { encrypted: string; iv: string } {
    try {
      const algorithm = 'aes-256-gcm';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(algorithm, Buffer.from(this.encryptionKey, 'hex'), iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Combine IV and auth tag with encrypted data
      const ivHex = iv.toString('hex');
      const tagHex = authTag.toString('hex');

      return {
        encrypted: encrypted,
        iv: ivHex + ':' + tagHex,
      };
    } catch (error) {
      logger.error('Encryption failed:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  private decrypt(encrypted: string, ivAndTag: string): string {
    try {
      const [ivHex, tagHex] = ivAndTag.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(tagHex, 'hex');

      const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(this.encryptionKey, 'hex'), iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Decryption failed:', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Store encrypted OAuth tokens for a user-tool pair
   */
  async storeTokens(userId: string, toolName: string, tokens: OAuthTokens): Promise<void> {
    try {
      const now = Date.now();

      // Encrypt sensitive token data
      const encryptedAccessToken = this.encrypt(tokens.accessToken);
      const encryptedRefreshToken = tokens.refreshToken
        ? this.encrypt(tokens.refreshToken)
        : null;

      const tokenData = {
        userId,
        toolName,
        accessToken: encryptedAccessToken.encrypted,
        refreshToken: encryptedRefreshToken?.encrypted || null,
        tokenType: tokens.tokenType,
        expiresAt: tokens.expiresAt || null,
        refreshExpiresAt: tokens.refreshExpiresAt || null,
        scopes: tokens.scopes ? tokens.scopes.join(' ') : null,
        metadata: tokens.metadata ? JSON.stringify(tokens.metadata) : null,
        // IVs are stored as metadata for decryption
        ivAccess: encryptedAccessToken.iv,
        ivRefresh: encryptedRefreshToken?.iv || null,
        createdAt: now,
        updatedAt: now,
      };

      // Insert or replace existing tokens
      await this.db.insert(oauthTokens).values(tokenData)
        .onConflictDoUpdate({
          target: [oauthTokens.userId, oauthTokens.toolName],
          set: {
            ...tokenData,
            updatedAt: now,
          },
        });

      logger.info(`Stored OAuth tokens for user ${userId}, tool ${toolName}`);

    } catch (error) {
      logger.error('Failed to store OAuth tokens:', error);
      throw new Error('Token storage failed');
    }
  }

  /**
   * Retrieve and decrypt OAuth tokens for a user-tool pair
   */
  async getTokens(userId: string, toolName: string): Promise<OAuthTokens | null> {
    try {
      const result = await this.db
        .select()
        .from(oauthTokens)
        .where(and(
          eq(oauthTokens.userId, userId),
          eq(oauthTokens.toolName, toolName)
        ))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const tokenRecord = result[0];

      // Decrypt tokens
      const accessToken = this.decrypt(
        tokenRecord.accessToken,
        tokenRecord.ivAccess
      );

      let refreshToken: string | undefined;
      if (tokenRecord.refreshToken && tokenRecord.ivRefresh) {
        refreshToken = this.decrypt(
          tokenRecord.refreshToken,
          tokenRecord.ivRefresh
        );
      }

      const tokens: OAuthTokens = {
        accessToken,
        refreshToken,
        tokenType: tokenRecord.tokenType,
        expiresAt: tokenRecord.expiresAt || undefined,
        refreshExpiresAt: tokenRecord.refreshExpiresAt || undefined,
        scopes: tokenRecord.scopes ? tokenRecord.scopes.split(' ') : undefined,
        metadata: tokenRecord.metadata ? JSON.parse(tokenRecord.metadata) : undefined,
      };

      return tokens;

    } catch (error) {
      logger.error('Failed to retrieve OAuth tokens:', error);
      return null;
    }
  }

  /**
   * Check if tokens need refresh
   */
  shouldRefresh(tokens: OAuthTokens): boolean {
    if (!tokens.expiresAt) return false;

    // Refresh if token expires within 5 minutes
    const refreshThreshold = 5 * 60 * 1000; // 5 minutes
    return (tokens.expiresAt - Date.now()) < refreshThreshold;
  }

  /**
   * Check if tokens are expired
   */
  areExpired(tokens: OAuthTokens): boolean {
    if (!tokens.expiresAt) return false;
    return tokens.expiresAt <= Date.now();
  }

  /**
   * Check if refresh token is expired
   */
  isRefreshExpired(tokens: OAuthTokens): boolean {
    if (!tokens.refreshExpiresAt) return true;
    return tokens.refreshExpiresAt <= Date.now();
  }

  /**
   * Remove tokens for a user-tool pair
   */
  async removeTokens(userId: string, toolName: string): Promise<void> {
    try {
      await this.db
        .delete(oauthTokens)
        .where(and(
          eq(oauthTokens.userId, userId),
          eq(oauthTokens.toolName, toolName)
        ));

      logger.info(`Removed OAuth tokens for user ${userId}, tool ${toolName}`);

    } catch (error) {
      logger.error('Failed to remove OAuth tokens:', error);
      throw new Error('Token removal failed');
    }
  }

  /**
   * Update token expiry times (useful after refresh)
   */
  async updateTokenExpiry(
    userId: string,
    toolName: string,
    expiresAt: number,
    refreshExpiresAt?: number
  ): Promise<void> {
    try {
      await this.db
        .update(oauthTokens)
        .set({
          expiresAt,
          refreshExpiresAt,
          updatedAt: Date.now(),
        })
        .where(and(
          eq(oauthTokens.userId, userId),
          eq(oauthTokens.toolName, toolName)
        ));

      logger.debug(`Updated token expiry for user ${userId}, tool ${toolName}`);

    } catch (error) {
      logger.error('Failed to update token expiry:', error);
      throw new Error('Token expiry update failed');
    }
  }

  /**
   * Get all expired tokens for refresh processing
   */
  async getExpiredTokens(): Promise<Array<{userId: string, toolName: string}>> {
    try {
      const now = Date.now();

      const results = await this.db
        .select({
          userId: oauthTokens.userId,
          toolName: oauthTokens.toolName,
        })
        .from(oauthTokens)
        .where(sql`expiresAt < ${now}`);

      return results;

    } catch (error) {
      logger.error('Failed to get expired tokens:', error);
      return [];
    }
  }

  /**
   * Clean up expired tokens (admin function)
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const now = Date.now();

      const result = await this.db
        .delete(oauthTokens)
        .where(sql`expiresAt < ${now} AND (refreshExpiresAt IS NULL OR refreshExpiresAt < ${now})`);

      // Cast result to access rowsAffected safely
      const rowsAffected = (result as any)?.rowsAffected || 0;
      logger.info(`Cleaned up ${rowsAffected} expired OAuth tokens`);
      return rowsAffected;

    } catch (error) {
      logger.error('Failed to cleanup expired tokens:', error);
      return 0;
    }
  }
}
