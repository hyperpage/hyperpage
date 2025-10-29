import logger from '../logger';
import { CacheFactory } from '../cache/cache-factory';
import { CacheBackend } from '../cache/cache-interface';

export interface CoordinationMessage {
  id: string;
  type: 'cache_invalidate' | 'job_coordination' | 'rate_limit_sync' | 'broadcast';
  payload: any;
  timestamp: number;
  sourcePod: string;
  priority: 'low' | 'normal' | 'high';
}

export interface LeaderElection {
  leaderId: string;
  term: number;
  lastHeartbeat: number;
  status: 'active' | 'expired';
}

export interface CoordinationHandler {
  (message: CoordinationMessage): Promise<void>;
}

/**
 * Pod Coordinator - Manages inter-pod communication and coordination
 * Uses Redis Pub/Sub for messaging and shared state for leader election
 */
export class PodCoordinator {
  private redisClient: any;
  private subscriberRedisClient: any;
  private connected = false;
  private podId: string;
  private leaderInfo: LeaderElection | null = null;
  private isLeader = false;
  private heartbeatTimer?: NodeJS.Timeout;
  private electionTimer?: NodeJS.Timeout;
  private handlers = new Map<string, CoordinationHandler>();

  // Configuration
  private readonly pubsubPrefix = 'hyperpage:coord:';
  private readonly leaderKey = 'hyperpage:leader';
  private readonly heartbeatInterval = 10000; // 10 seconds
  private readonly electionTimeout = 30000; // 30 seconds
  private readonly podHeartbeatKey = (podId: string) => `hyperpage:pod:${podId}:heartbeat`;

  constructor(podId?: string) {
    this.podId = podId || this.generatePodId();
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      // Main client for publishing and operations
      const cache = await CacheFactory.create({
        backend: CacheBackend.HYBRID,
        redisUrl: process.env.REDIS_URL,
        enableFallback: true,
      });

      this.redisClient = (cache as any).redisClient.getClient();

      // Separate subscriber client for Pub/Sub (required for ioredis)
      const subscriberCache = await CacheFactory.create({
        backend: CacheBackend.HYBRID,
        redisUrl: process.env.REDIS_URL,
        enableFallback: true,
      });

      this.subscriberRedisClient = (subscriberCache as any).redisClient.getClient();

      this.connected = true;
      this.setupMessageHandlers();
      this.startLeaderElection();

      logger.info(`Pod Coordinator initialized. Pod ID: ${this.podId}`);
    } catch (error) {
      logger.error('Failed to initialize Pod Coordinator:', error);
      this.connected = false;
    }
  }

  /**
   * Generate unique pod ID
   */
  private generatePodId(): string {
    // Use hostname or generate UUID-like identifier
    // In K8s this would be the pod name
    const hostname = process.env.HOSTNAME || 'unknown';
    const random = Math.random().toString(36).substr(2, 9);
    return `${hostname}-${random}`;
  }

  /**
   * Setup Pub/Sub message handlers
   */
  private setupMessageHandlers(): void {
    if (!this.subscriberRedisClient) return;

    this.subscriberRedisClient.on('message', (channel: string, message: string) => {
      try {
        const coordinationMessage: CoordinationMessage = JSON.parse(message);
        this.handleIncomingMessage(coordinationMessage);
      } catch (error) {
        logger.error('Failed to parse coordination message:', error);
      }
    });

    // Subscribe to coordination channels
    this.subscriberRedisClient.subscribe(`${this.pubsubPrefix}all`);
    this.subscriberRedisClient.subscribe(`${this.pubsubPrefix}${this.podId}`);
  }

  /**
   * Handle incoming coordination messages
   */
  private async handleIncomingMessage(message: CoordinationMessage): Promise<void> {
    logger.debug(`Received coordination message: ${message.type} from ${message.sourcePod}`);

    const handler = this.handlers.get(message.type) || this.handlers.get('*');
    if (handler) {
      try {
        await handler(message);
      } catch (error) {
        logger.error(`Error handling coordination message ${message.id}:`, error);
      }
    }

    // Handle specific message types
    switch (message.type) {
      case 'cache_invalidate':
        await this.handleCacheInvalidation(message);
        break;
      case 'rate_limit_sync':
        await this.handleRateLimitSync(message);
        break;
    }
  }

  /**
   * Broadcast message to all pods
   */
  async broadcast(type: CoordinationMessage['type'], payload: any, priority: CoordinationMessage['priority'] = 'normal'): Promise<void> {
    if (!this.connected || !this.redisClient) {
      logger.warn('Pod Coordinator not connected, cannot broadcast');
      return;
    }

    const message: CoordinationMessage = {
      id: this.generateMessageId(),
      type,
      payload,
      timestamp: Date.now(),
      sourcePod: this.podId,
      priority,
    };

    try {
      const channel = `${this.pubsubPrefix}all`;
      await this.redisClient.publish(channel, JSON.stringify(message));

      logger.debug(`Broadcasted message ${message.id} to ${channel}`);
    } catch (error) {
      logger.error('Failed to broadcast message:', error);
    }
  }

  /**
   * Send message to specific pod
   */
  async sendToPod(podId: string, type: CoordinationMessage['type'], payload: any, priority: CoordinationMessage['priority'] = 'normal'): Promise<void> {
    if (!this.connected || !this.redisClient) {
      logger.warn('Pod Coordinator not connected, cannot send message');
      return;
    }

    const message: CoordinationMessage = {
      id: this.generateMessageId(),
      type,
      payload,
      timestamp: Date.now(),
      sourcePod: this.podId,
      priority,
    };

    try {
      const channel = `${this.pubsubPrefix}${podId}`;
      await this.redisClient.publish(channel, JSON.stringify(message));

      logger.debug(`Sent message ${message.id} to pod ${podId}`);
    } catch (error) {
      logger.error(`Failed to send message to pod ${podId}:`, error);
    }
  }

  /**
   * Register handler for message types
   */
  onMessage(type: string, handler: CoordinationHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Start leader election process
   */
  private async startLeaderElection(): Promise<void> {
    if (!this.connected) return;

    try {
      // Try to become leader
      const leaderData = JSON.stringify({
        leaderId: this.podId,
        term: (this.leaderInfo?.term || 0) + 1,
        lastHeartbeat: Date.now(),
        status: 'active' as const,
      });

      const wasSet = await this.redisClient.set(
        this.leaderKey,
        leaderData,
        'NX',  // Only set if key doesn't exist
        'EX',  // Expire
        Math.ceil(this.electionTimeout / 1000) + 10 // Extra 10 seconds
      );

      if (wasSet) {
        this.leaderInfo = {
          leaderId: this.podId,
          term: (this.leaderInfo?.term || 0) + 1,
          lastHeartbeat: Date.now(),
          status: 'active',
        };
        this.isLeader = true;

        logger.info(`Pod ${this.podId} became leader (term ${this.leaderInfo.term})`);
        this.startLeadership();
      } else {
        // Someone else is leader, get their info
        const existingLeaderData = await this.redisClient.get(this.leaderKey);
        if (existingLeaderData) {
          this.leaderInfo = JSON.parse(existingLeaderData) as LeaderElection;
          this.isLeader = this.leaderInfo.leaderId === this.podId;
        } else {
          this.isLeader = false;
        }

        this.startFollowership();
      }
    } catch (error) {
      logger.error('Leader election failed:', error);
    }
  }

  /**
   * Start leadership duties
   */
  private startLeadership(): void {
    // Send regular heartbeats
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);

    // Set up leadership timeout
    this.electionTimer = setTimeout(() => {
      logger.warn('Leadership expired, initiating new election');
      this.isLeader = false;
      this.startLeaderElection();
    }, this.electionTimeout);
  }

  /**
   * Start followership duties (monitoring leader)
   */
  private startFollowership(): void {
    if (this.isLeader) return;

    // Monitor leader health
    this.electionTimer = setInterval(async () => {
      if (!this.leaderInfo || this.leaderInfo.status !== 'active') return;

      const timeSinceHeartbeat = Date.now() - this.leaderInfo.lastHeartbeat;
      if (timeSinceHeartbeat > this.electionTimeout) {
        logger.warn(`Leader ${this.leaderInfo.leaderId} appears dead, starting election`);
        this.startLeaderElection();
      }
    }, this.heartbeatInterval);
  }

  /**
   * Send leadership heartbeat
   */
  private async sendHeartbeat(): Promise<void> {
    if (!this.isLeader || !this.leaderInfo) return;

    try {
      const updatedLeaderData = {
        ...this.leaderInfo,
        lastHeartbeat: Date.now(),
      };

      await this.redisClient.set(
        this.leaderKey,
        JSON.stringify(updatedLeaderData),
        'EX',
        Math.ceil(this.electionTimeout / 1000) + 10
      );

      this.leaderInfo = updatedLeaderData;

      // Broadcast heartbeat to all pods
      await this.broadcast('broadcast', { type: 'leader_heartbeat', leaderId: this.podId }, 'low');
    } catch (error) {
      logger.error('Failed to send heartbeat:', error);
      // Resign leadership and start new election
      this.isLeader = false;
      setTimeout(() => this.startLeaderElection(), 1000);
    }
  }

  /**
   * Get current leader info
   */
  async getLeader(): Promise<LeaderElection | null> {
    if (!this.connected) return null;

    try {
      const leaderData = await this.redisClient.get(this.leaderKey);
      return leaderData ? JSON.parse(leaderData) : null;
    } catch (error) {
      logger.error('Failed to get leader info:', error);
      return null;
    }
  }

  /**
   * Check if this pod is the leader
   */
  getIsLeader(): boolean {
    return this.isLeader && this.leaderInfo?.status === 'active';
  }

  /**
   * Coordinate operation (leader-only)
   */
  async coordinate(operation: 'cache_warmup' | 'bg_job_balance' | 'cleanup', data?: any): Promise<boolean> {
    if (!this.getIsLeader()) {
      logger.debug('Only leader can coordinate operations');
      return false;
    }

    try {
      // Send coordination broadcast
      await this.broadcast('job_coordination', { operation, data, coordinator: this.podId }, 'high');
      return true;
    } catch (error) {
      logger.error(`Failed to coordinate operation ${operation}:`, error);
      return false;
    }
  }

  /**
   * Handle cache invalidation messages
   */
  private async handleCacheInvalidation(message: CoordinationMessage): Promise<void> {
    // Invalidate local cache entries
    const keysToInvalidate = message.payload.keys || [];
    logger.info(`Invalidating cache keys: ${keysToInvalidate.join(', ')}`);

    // This would integrate with the local cache system
    // For now, just log the operation
  }

  /**
   * Handle rate limit sync messages
   */
  private async handleRateLimitSync(message: CoordinationMessage): Promise<void> {
    const { platform, usage } = message.payload;
    logger.info(`Syncing rate limit for ${platform}: ${usage}`);

    // This would update local rate limit tracking
    // For now, just log the operation
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `msg-${timestamp}-${random}`;
  }

  /**
   * Get current pod ID
   */
  getPodId(): string {
    return this.podId;
  }

  /**
   * Get list of active pods (based on recent heartbeats)
   */
  async getActivePods(): Promise<string[]> {
    if (!this.connected) return [];

    try {
      // Scan for pod heartbeat keys
      const [cursor, keys] = await this.redisClient.scan(0, 'MATCH', 'hyperpage:pod:*:heartbeat', 'COUNT', 1000);

      // Extract pod IDs and check recency
      const activePods: string[] = [];
      for (const key of keys) {
        try {
          const heartbeatData = await this.redisClient.get(key);
          if (heartbeatData) {
            const heartbeat = JSON.parse(heartbeatData);
            const age = Date.now() - heartbeat.timestamp;
            if (age < this.heartbeatInterval * 3) { // 3x heartbeat interval
              activePods.push(heartbeat.podId);
            }
          }
        } catch (error) {
          // Skip invalid entries
        }
      }

      return activePods;
    } catch (error) {
      logger.error('Failed to get active pods:', error);
      return [];
    }
  }

  /**
   * Clean shutdown
   */
  async shutdown(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    if (this.electionTimer) {
      clearTimeout(this.electionTimer);
    }

    // Unsubscribe from channels
    if (this.subscriberRedisClient) {
      try {
        await this.subscriberRedisClient.unsubscribe();
      } catch (error) {
        // Ignore
      }
    }

    logger.info(`Pod Coordinator ${this.podId} shutting down`);
  }
}

// Default singleton instance
export const podCoordinator = new PodCoordinator();
