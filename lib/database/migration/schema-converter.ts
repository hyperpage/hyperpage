/**
 * Schema Conversion Utilities for SQLite to PostgreSQL Migration
 * Phase 6: Data Migration
 *
 * IMPORTANT:
 * - This module is migration tooling only (ops/one-off scripts).
 * - It is NOT imported by the main runtime.
 * - It assumes SQLite as a legacy source and PostgreSQL as the target.
 */

import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { PgTable } from "drizzle-orm/pg-core";

/**
 * SQLite to PostgreSQL data type mappings
 */
const TYPE_MAPPINGS: Record<string, string> = {
  // Basic types
  'text': 'text',
  'varchar': 'varchar',
  'char': 'char',
  'integer': 'integer',
  'bigint': 'bigint',
  'numeric': 'numeric',
  'real': 'real',
  'float': 'float',
  'double': 'double precision',
  'boolean': 'boolean',
  'blob': 'bytea',
  'json': 'jsonb',
  'date': 'date',
  'datetime': 'timestamp with time zone',
  'time': 'time',
  'uuid': 'uuid',
  
  // Special SQLite types
  'any': 'jsonb', // For dynamic/any fields
  'primary key': 'PRIMARY KEY',
  'autoincrement': 'SERIAL',
  'default now()': 'DEFAULT now()',
  'default current_timestamp': 'DEFAULT now()',
  'not null': 'NOT NULL',
  'unique': 'UNIQUE',
  'default': 'DEFAULT',
};

/**
 * Migration column mapping interface
 */
interface ColumnMapping {
  name: string;
  sqliteType: string;
  pgType: string;
  nullable: boolean;
  default?: string;
  primaryKey: boolean;
  unique: boolean;
}

/**
 * Table mapping interface
 */
interface TableMapping {
  sqliteTable: SQLiteTable;
  pgTable: PgTable;
  columns: ColumnMapping[];
  pkColumns: string[];
  indexes: Array<{
    name: string;
    columns: string[];
    unique: boolean;
  }>;
  foreignKeys: Array<{
    column: string;
    referencedTable: string;
    referencedColumn: string;
  }>;
}

/**
 * Convert SQLite data type to PostgreSQL equivalent
 */
function convertType(sqliteType: string, isPrimaryKey = false): string {
  const type = sqliteType.toLowerCase().trim();
  
  // Handle autoincrement (INTEGER PRIMARY KEY in SQLite becomes bigserial in PostgreSQL)
  if (isPrimaryKey && type === 'integer') {
    return 'bigserial';
  }
  
  return TYPE_MAPPINGS[type] || 'text';
}

/**
 * Analyze SQLite table schema
 */
function analyzeSQLiteTable(table: SQLiteTable): {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    default?: string;
    isPrimaryKey: boolean;
  }>;
} {
  // Since drizzle-orm doesn't expose full schema introspection easily,
  // we'll use a simplified approach based on common table names
  const tableName = getTableName(table);
  
  // Get column info from common table patterns
  const columns = getCommonColumnInfo(tableName);
  
  return {
    name: tableName,
    columns,
  };
}

/**
 * Get table name from SQLiteTable
 */
function getTableName(table: SQLiteTable): string {
  // Try to extract table name - this is a simplified approach
  // In a real implementation, you'd use drizzle's internal APIs.
  // Cast through unknown instead of using `any` to satisfy linting.
  const tableWithName = table as unknown as { name?: string };
  return tableWithName.name ?? "unknown_table";
}

/**
 * Get common column information based on table structure
 */
function getCommonColumnInfo(tableName: string): Array<{
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
  isPrimaryKey: boolean;
}> {
  // This is a simplified approach for common table structures
  // In a real implementation, you'd read the actual schema
  const commonPatterns: Record<string, Array<{ name: string; type: string; nullable: boolean; default?: string; isPrimaryKey: boolean }>> = {
    'jobs': [
      { name: 'id', type: 'text', nullable: false, isPrimaryKey: true },
      { name: 'type', type: 'text', nullable: false, isPrimaryKey: false },
      { name: 'name', type: 'text', nullable: false, isPrimaryKey: false },
      { name: 'status', type: 'text', nullable: false, isPrimaryKey: false },
      { name: 'payload', type: 'text', nullable: false, isPrimaryKey: false },
      { name: 'result', type: 'text', nullable: true, isPrimaryKey: false },
      { name: 'tool', type: 'text', nullable: true, isPrimaryKey: false },
      { name: 'endpoint', type: 'text', nullable: true, isPrimaryKey: false },
      { name: 'priority', type: 'integer', nullable: false, default: '0', isPrimaryKey: false },
      { name: 'scheduledAt', type: 'integer', nullable: true, isPrimaryKey: false },
      { name: 'startedAt', type: 'integer', nullable: true, isPrimaryKey: false },
      { name: 'completedAt', type: 'integer', nullable: true, isPrimaryKey: false },
      { name: 'retryCount', type: 'integer', nullable: false, default: '0', isPrimaryKey: false },
      { name: 'persistedAt', type: 'integer', nullable: false, isPrimaryKey: false },
      { name: 'recoveryAttempts', type: 'integer', nullable: false, default: '0', isPrimaryKey: false },
      { name: 'attempts', type: 'integer', nullable: false, default: '0', isPrimaryKey: false },
      { name: 'lastError', type: 'text', nullable: true, isPrimaryKey: false },
      { name: 'createdAt', type: 'integer', nullable: false, isPrimaryKey: false },
      { name: 'updatedAt', type: 'integer', nullable: false, isPrimaryKey: false },
    ],
    'tool_configs': [
      { name: 'tool_name', type: 'text', nullable: false, isPrimaryKey: true },
      { name: 'enabled', type: 'integer', nullable: false, default: '1', isPrimaryKey: false },
      { name: 'config', type: 'text', nullable: true, isPrimaryKey: false },
      { name: 'refresh_interval', type: 'integer', nullable: true, isPrimaryKey: false },
      { name: 'notifications', type: 'integer', nullable: false, default: '1', isPrimaryKey: false },
      { name: 'updated_at', type: 'integer', nullable: false, isPrimaryKey: false },
    ],
    'rate_limits': [
      { name: 'id', type: 'text', nullable: false, isPrimaryKey: true },
      { name: 'platform', type: 'text', nullable: false, isPrimaryKey: false },
      { name: 'limit_remaining', type: 'integer', nullable: true, isPrimaryKey: false },
      { name: 'limit_total', type: 'integer', nullable: true, isPrimaryKey: false },
      { name: 'reset_time', type: 'integer', nullable: true, isPrimaryKey: false },
      { name: 'last_updated', type: 'integer', nullable: false, isPrimaryKey: false },
      { name: 'created_at', type: 'integer', nullable: false, default: Math.floor(Date.now()).toString(), isPrimaryKey: false },
    ],
    'app_state': [
      { name: 'key', type: 'text', nullable: false, isPrimaryKey: true },
      { name: 'value', type: 'text', nullable: false, isPrimaryKey: false },
    ],
    'oauth_tokens': [
      { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true },
      { name: 'userId', type: 'text', nullable: false, isPrimaryKey: false },
      { name: 'toolName', type: 'text', nullable: false, isPrimaryKey: false },
      { name: 'accessToken', type: 'text', nullable: false, isPrimaryKey: false },
      { name: 'refreshToken', type: 'text', nullable: true, isPrimaryKey: false },
      { name: 'tokenType', type: 'text', nullable: false, isPrimaryKey: false },
      { name: 'expiresAt', type: 'integer', nullable: true, isPrimaryKey: false },
      { name: 'refreshExpiresAt', type: 'integer', nullable: true, isPrimaryKey: false },
      { name: 'scopes', type: 'text', nullable: true, isPrimaryKey: false },
      { name: 'metadata', type: 'text', nullable: true, isPrimaryKey: false },
      { name: 'ivAccess', type: 'text', nullable: false, isPrimaryKey: false },
      { name: 'ivRefresh', type: 'text', nullable: true, isPrimaryKey: false },
      { name: 'createdAt', type: 'integer', nullable: false, isPrimaryKey: false },
      { name: 'updatedAt', type: 'integer', nullable: false, isPrimaryKey: false },
    ],
    'users': [
      { name: 'id', type: 'text', nullable: false, isPrimaryKey: true },
      { name: 'provider', type: 'text', nullable: false, isPrimaryKey: false },
      { name: 'providerUserId', type: 'text', nullable: false, isPrimaryKey: false },
      { name: 'email', type: 'text', nullable: true, isPrimaryKey: false },
      { name: 'username', type: 'text', nullable: true, isPrimaryKey: false },
      { name: 'displayName', type: 'text', nullable: true, isPrimaryKey: false },
      { name: 'avatarUrl', type: 'text', nullable: true, isPrimaryKey: false },
      { name: 'createdAt', type: 'integer', nullable: false, isPrimaryKey: false },
      { name: 'updatedAt', type: 'integer', nullable: false, isPrimaryKey: false },
    ],
  };

  return commonPatterns[tableName] || [
    { name: 'id', type: 'text', nullable: false, isPrimaryKey: true },
    { name: 'createdAt', type: 'integer', nullable: false, isPrimaryKey: false },
    { name: 'updatedAt', type: 'integer', nullable: false, isPrimaryKey: false },
  ];
}

/**
 * Get PostgreSQL table name
 */
function getPgTableName(table: PgTable): string {
  // Try to extract table name - this is a simplified approach.
  // Cast through unknown instead of using `any` to satisfy linting.
  const tableWithName = table as unknown as { name?: string };
  return tableWithName.name ?? "unknown_table";
}

/**
 * Generate PostgreSQL table creation SQL
 */
function generatePostgreSQLTableSQL(mapping: TableMapping): string {
  const tableName = getPgTableName(mapping.pgTable);
  const columns: string[] = [];
  
  // Generate column definitions
  for (const column of mapping.columns) {
    const parts = [column.name, column.pgType];
    
    // Add constraints
    if (!column.nullable) {
      parts.push('NOT NULL');
    }
    
    if (column.unique) {
      parts.push('UNIQUE');
    }
    
    if (column.default) {
      parts.push('DEFAULT', column.default);
    }
    
    if (column.primaryKey) {
      parts.push('PRIMARY KEY');
    }
    
    columns.push(parts.join(' '));
  }
  
  // Generate table creation SQL
  const createTableSQL = `
CREATE TABLE IF NOT EXISTS ${tableName} (
  ${columns.join(',\n  ')}
);`;

  // Add indexes
  let indexSQL = '';
  for (const index of mapping.indexes) {
    if (index.unique) {
      indexSQL += `
CREATE UNIQUE INDEX IF NOT EXISTS ${index.name} ON ${tableName} (${index.columns.join(', ')});`;
    } else {
      indexSQL += `
CREATE INDEX IF NOT EXISTS ${index.name} ON ${tableName} (${index.columns.join(', ')});`;
    }
  }
  
  return createTableSQL + indexSQL;
}

/**
 * Generate data migration queries
 */
function generateDataMigrationQueries(mapping: TableMapping): {
  insertQuery: string;
  fieldMapping: Array<{ sqlite: string; pg: string }>;
} {
  const sqliteFields = mapping.columns.map(col => col.name);
  const pgFields = mapping.columns.map(col => col.name);
  
  return {
    insertQuery: `INSERT INTO ${getPgTableName(mapping.pgTable)} (${pgFields.join(', ')}) 
SELECT ${pgFields.map((field, i) => {
  const sqliteField = sqliteFields[i];
  const column = mapping.columns[i];
  
  // Handle type conversions
  if (column.pgType === 'jsonb' && column.sqliteType === 'text') {
    return `CAST(${sqliteField} AS jsonb)`;
  }
  if (column.pgType === 'timestamp with time zone' && column.sqliteType === 'integer') {
    return `to_timestamp(${sqliteField} / 1000)`;
  }
  if (column.pgType === 'bigserial' && column.sqliteType === 'integer') {
    return `nextval(pg_get_serial_sequence('${getPgTableName(mapping.pgTable)}', '${field}'))`;
  }
  
  return sqliteField;
}).join(', ')}) 
FROM ${getTableName(mapping.sqliteTable)};`,
    fieldMapping: mapping.columns.map(col => ({
      sqlite: col.name,
      pg: col.name,
    })),
  };
}

/**
 * Create complete table mapping
 */
function createTableMapping(
  sqliteTable: SQLiteTable,
  pgTable: PgTable,
  options: {
    handleTimestamps?: boolean;
    handleJsonFields?: boolean;
    customMappings?: Record<string, string>;
  } = {}
): TableMapping {
  const sqliteAnalysis = analyzeSQLiteTable(sqliteTable);
  
  const columns: ColumnMapping[] = [];
  const pkColumns: string[] = [];
  
  // Map columns
  for (const sqliteColumn of sqliteAnalysis.columns) {
    let pgType = convertType(sqliteColumn.type, sqliteColumn.isPrimaryKey);
    
    // Apply custom mappings
    if (options.customMappings && options.customMappings[sqliteColumn.name]) {
      pgType = options.customMappings[sqliteColumn.name];
    }
    
    // Handle timestamps
    if (options.handleTimestamps && sqliteColumn.type === 'integer' && sqliteColumn.name.toLowerCase().includes('time')) {
      pgType = 'timestamp with time zone';
    }
    
    // Handle JSON fields
    if (options.handleJsonFields && sqliteColumn.type === 'text') {
      pgType = 'jsonb';
    }
    
    columns.push({
      name: sqliteColumn.name,
      sqliteType: sqliteColumn.type,
      pgType,
      nullable: sqliteColumn.nullable,
      default: sqliteColumn.default,
      primaryKey: sqliteColumn.isPrimaryKey,
      unique: false, // Will be set from index analysis
    });
    
    if (sqliteColumn.isPrimaryKey) {
      pkColumns.push(sqliteColumn.name);
    }
  }
  
  return {
    sqliteTable,
    pgTable,
    columns,
    pkColumns,
    indexes: [],
    foreignKeys: [],
  };
}

/**
 * Validation query generators
 */
function generateValidationQueries(mapping: TableMapping): {
  countQuery: string;
  sampleQuery: string;
  integrityChecks: string[];
} {
  const tableName = getPgTableName(mapping.pgTable);
  const sqliteTableName = getTableName(mapping.sqliteTable);
  
  return {
    countQuery: `
SELECT 
  '${tableName}' as table_name,
  (SELECT COUNT(*) FROM ${sqliteTableName}) as sqlite_count,
  (SELECT COUNT(*) FROM ${tableName}) as pg_count,
  CASE 
    WHEN (SELECT COUNT(*) FROM ${sqliteTableName}) = (SELECT COUNT(*) FROM ${tableName}) 
    THEN 'PASS' 
    ELSE 'FAIL' 
  END as status;`,
    
    sampleQuery: `
SELECT * FROM ${tableName} LIMIT 5;`,
    
    integrityChecks: [
      `SELECT COUNT(*) as null_count FROM ${tableName} WHERE id IS NULL;`,
      `SELECT COUNT(DISTINCT id) as unique_count FROM ${tableName};`,
      `SELECT COUNT(*) as total_count FROM ${tableName};`,
    ],
  };
}

/**
 * Export all utilities
 */
export const SchemaConverter = {
  convertType,
  analyzeSQLiteTable,
  generatePostgreSQLTableSQL,
  generateDataMigrationQueries,
  createTableMapping,
  generateValidationQueries,
};

export type {
  ColumnMapping,
  TableMapping,
};
