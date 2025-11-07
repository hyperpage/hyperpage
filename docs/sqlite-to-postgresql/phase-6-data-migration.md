# Phase 6: Data Migration

**Duration:** 1-2 hours  
**Status:** Ready for Implementation  
**Prerequisites:** Phase 1-5 completed

## Overview

This phase creates the data migration scripts to export data from SQLite and import it into PostgreSQL, ensuring data integrity and proper transformation of data types.

## Data Migration Strategy

### Migration Approach

1. **Export from SQLite**: Extract all data with proper type conversion
2. **Transform Data**: Convert timestamps, JSON, and other data types
3. **Import to PostgreSQL**: Load data with validation
4. **Verify Integrity**: Ensure all data transferred correctly

### Data Transformation Requirements

- **Timestamps**: Unix epoch → PostgreSQL TIMESTAMP WITH TIME ZONE
- **JSON Data**: Text-based JSON → PostgreSQL JSONB
- **Boolean Values**: Integer (0/1) → PostgreSQL BOOLEAN
- **Auto-increment**: Reset sequences for SERIAL fields

## Implementation Steps

### Step 1: SQLite Data Export Script

#### lib/database/export-sqlite.ts

```typescript
import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";

export interface ExportOptions {
  includeSchema?: boolean;
  batchSize?: number;
  outputFormat?: "sql" | "json";
}

export interface TableData {
  tableName: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export class SQLiteExporter {
  private db: Database.Database;
  private outputPath: string;

  constructor(dbPath: string, outputPath: string) {
    this.db = new Database(dbPath);
    this.outputPath = outputPath;
  }

  async exportAllData(options: ExportOptions = {}): Promise<void> {
    const {
      includeSchema = false,
      batchSize = 1000,
      outputFormat = "sql",
    } = options;

    console.log("📦 Starting SQLite data export...");

    try {
      // Get all tables
      const tables = this.getAllTables();
      console.log(`Found ${tables.length} tables to export`);

      if (outputFormat === "sql") {
        await this.exportToSQL(tables, includeSchema);
      } else {
        await this.exportToJSON(tables);
      }

      console.log("✅ Data export completed successfully");
    } catch (error) {
      console.error("❌ Data export failed:", error);
      throw error;
    } finally {
      this.db.close();
    }
  }

  private getAllTables(): string[] {
    const result = this.db
      .prepare(
        `
      SELECT name 
      FROM sqlite_master 
      WHERE type='table' 
      AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `,
      )
      .all() as { name: string }[];

    return result.map((row) => row.name);
  }

  private async exportToSQL(
    tables: string[],
    includeSchema: boolean,
  ): Promise<void> {
    const sqlStatements: string[] = [];

    // Add header
    sqlStatements.push("-- SQLite to PostgreSQL Data Export");
    sqlStatements.push(`-- Generated: ${new Date().toISOString()}`);
    sqlStatements.push("-- Tables: " + tables.join(", "));
    sqlStatements.push("");

    if (includeSchema) {
      sqlStatements.push("-- Schema Creation");
      sqlStatements.push(await this.generateSchemaSQL(tables));
      sqlStatements.push("");
    }

    // Export data for each table
    for (const tableName of tables) {
      console.log(`Exporting table: ${tableName}`);
      const tableData = await this.getTableData(tableName);

      if (tableData.rows.length > 0) {
        sqlStatements.push(`-- Data for table: ${tableName}`);
        sqlStatements.push(this.generateInsertSQL(tableData));
        sqlStatements.push("");
      }
    }

    // Write to file
    await fs.promises.writeFile(this.outputPath, sqlStatements.join("\n"));
  }

  private async exportToJSON(tables: string[]): Promise<void> {
    const exportData: Record<string, TableData> = {};

    for (const tableName of tables) {
      console.log(`Exporting table: ${tableName}`);
      exportData[tableName] = await this.getTableData(tableName);
    }

    // Write JSON export
    await fs.promises.writeFile(
      this.outputPath,
      JSON.stringify(exportData, null, 2),
    );
  }

  private async getTableData(tableName: string): Promise<TableData> {
    // Get column information
    const columns = this.db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;

    const columnNames = columns.map((col) => col.name);

    // Get all rows
    const rows = this.db.prepare(`SELECT * FROM ${tableName}`).all() as Record<
      string,
      unknown
    >[];

    return {
      tableName,
      columns: columnNames,
      rows: rows.map((row) => this.transformRow(row, columns)),
      rowCount: rows.length,
    };
  }

  private transformRow(
    row: Record<string, unknown>,
    columns: any[],
  ): Record<string, unknown> {
    const transformed: Record<string, unknown> = {};

    for (const column of columns) {
      const value = row[column.name];

      // Transform based on column type
      if (column.type === "INTEGER" && column.name.includes("_at")) {
        // Timestamp conversion
        transformed[column.name] = value
          ? new Date(Number(value)).toISOString()
          : null;
      } else if (
        column.type === "INTEGER" &&
        (column.name === "enabled" || column.name === "notifications")
      ) {
        // Boolean conversion
        transformed[column.name] = value === 1 || value === true;
      } else if (column.type === "TEXT" && this.isJSON(value as string)) {
        // JSON parsing
        try {
          transformed[column.name] = JSON.parse(value as string);
        } catch {
          transformed[column.name] = value;
        }
      } else {
        transformed[column.name] = value;
      }
    }

    return transformed;
  }

  private isJSON(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  private async generateSchemaSQL(tables: string[]): Promise<string> {
    const schemaStatements: string[] = [];

    for (const tableName of tables) {
      const createTableSQL = this.db
        .prepare(
          `
        SELECT sql 
        FROM sqlite_master 
        WHERE type='table' 
        AND name=?
      `,
        )
        .get(tableName) as { sql: string };

      if (createTableSQL?.sql) {
        schemaStatements.push(`-- Schema for ${tableName}`);
        schemaStatements.push(
          createTableSQL.sql.replace(/sqlite_/g, "postgres_"),
        );
        schemaStatements.push("");
      }
    }

    return schemaStatements.join("\n");
  }

  private generateInsertSQL(tableData: TableData): string {
    const { tableName, columns, rows } = tableData;

    if (rows.length === 0) {
      return `-- No data for table ${tableName}`;
    }

    const insertStatements: string[] = [];
    const batchSize = 1000;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);

      const values = batch.map((row) => {
        const rowValues = columns.map((column) => {
          const value = row[column];
          return this.formatValueForPostgreSQL(value);
        });
        return `(${rowValues.join(", ")})`;
      });

      insertStatements.push(
        `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES\n` +
          values.join(",\n") +
          ";",
      );
    }

    return insertStatements.join("\n\n");
  }

  private formatValueForPostgreSQL(value: unknown): string {
    if (value === null || value === undefined) return "NULL";
    if (typeof value === "number") return value.toString();
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    if ((typeof value) instanceof Date) return `'${value.toISOString()}'`;
    if (typeof value === "object")
      return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
    if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  async getExportSummary(): Promise<{
    totalTables: number;
    totalRows: number;
    tableRowCounts: Record<string, number>;
  }> {
    const tables = this.getAllTables();
    const tableRowCounts: Record<string, number> = {};
    let totalRows = 0;

    for (const tableName of tables) {
      const count = this.db
        .prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
        .get() as { count: number };
      tableRowCounts[tableName] = count.count;
      totalRows += count.count;
    }

    return {
      totalTables: tables.length,
      totalRows,
      tableRowCounts,
    };
  }
}

// Export function for easy use
export async function exportSQLiteData(
  dbPath: string,
  outputPath: string,
  options: ExportOptions = {},
): Promise<void> {
  const exporter = new SQLiteExporter(dbPath, outputPath);
  await exporter.exportAllData(options);
}
```

### Step 2: PostgreSQL Data Import Script

#### lib/database/import-postgresql.ts

```typescript
import { Pool } from "pg";
import * as fs from "fs";

export interface ImportOptions {
  batchSize?: number;
  validateData?: boolean;
  skipErrors?: boolean;
  truncateFirst?: boolean;
}

export interface ImportResult {
  success: boolean;
  tablesImported: number;
  totalRowsImported: number;
  errors: string[];
  duration: number;
}

export class PostgreSQLImporter {
  private pool: Pool;
  private sqlFilePath: string;

  constructor(pool: Pool, sqlFilePath: string) {
    this.pool = pool;
    this.sqlFilePath = sqlFilePath;
  }

  async importData(options: ImportOptions = {}): Promise<ImportResult> {
    const {
      batchSize = 1000,
      validateData = true,
      skipErrors = false,
      truncateFirst = false,
    } = options;

    const startTime = Date.now();
    const errors: string[] = [];
    let tablesImported = 0;
    let totalRowsImported = 0;

    console.log("📥 Starting PostgreSQL data import...");

    try {
      // Read SQL file
      const sqlContent = await fs.promises.readFile(this.sqlFilePath, "utf8");
      const statements = this.parseSQLStatements(sqlContent);

      console.log(`Found ${statements.length} SQL statements to execute`);

      // Execute statements in batches
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i].trim();

        if (!statement || statement.startsWith("--")) {
          continue;
        }

        try {
          if (statement.toLowerCase().startsWith("insert into")) {
            // Handle INSERT statements
            const result = await this.pool.query(statement);
            totalRowsImported += result.rowCount || 0;

            if (result.rowCount && result.rowCount > 0) {
              tablesImported++;
            }
          } else {
            // Handle other statements (CREATE TABLE, etc.)
            await this.pool.query(statement);
          }

          // Progress reporting
          if ((i + 1) % 10 === 0) {
            console.log(`Processed ${i + 1}/${statements.length} statements`);
          }
        } catch (error) {
          const errorMsg = `Statement ${i + 1} failed: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);

          if (!skipErrors) {
            throw error;
          }
        }
      }

      // Validate import if requested
      if (validateData) {
        await this.validateImport();
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Import completed in ${duration}ms`);

      return {
        success: errors.length === 0,
        tablesImported,
        totalRowsImported,
        errors,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error("❌ Import failed:", error);

      return {
        success: false,
        tablesImported,
        totalRowsImported,
        errors: [
          ...errors,
          error instanceof Error ? error.message : String(error),
        ],
        duration,
      };
    }
  }

  private parseSQLStatements(sqlContent: string): string[] {
    // Split by semicolon but handle quoted strings and comments
    const statements: string[] = [];
    let current = "";
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < sqlContent.length; i++) {
      const char = sqlContent[i];
      const nextChar = sqlContent[i + 1];

      // Handle line comments
      if (!inSingleQuote && !inDoubleQuote && !inBlockComment) {
        if (char === "-" && nextChar === "-") {
          inLineComment = true;
          current += char;
          continue;
        }
        if (char === "/" && nextChar === "*") {
          inBlockComment = true;
          current += char;
          continue;
        }
      }

      // Handle comments
      if (inLineComment) {
        if (char === "\n") {
          inLineComment = false;
        }
        current += char;
        continue;
      }

      if (inBlockComment) {
        if (char === "*" && nextChar === "/") {
          inBlockComment = false;
          current += char;
        }
        current += char;
        continue;
      }

      // Handle quotes
      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
      }

      current += char;

      // Split on semicolon if not in quotes
      if (char === ";" && !inSingleQuote && !inDoubleQuote) {
        statements.push(current.trim());
        current = "";
      }
    }

    // Add remaining content
    if (current.trim()) {
      statements.push(current.trim());
    }

    return statements.filter((stmt) => stmt.length > 0);
  }

  private async validateImport(): Promise<void> {
    console.log("🔍 Validating imported data...");

    // Check row counts
    const tables = await this.pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    for (const table of tables.rows) {
      const tableName = table.table_name;

      try {
        const countResult = await this.pool.query(
          `SELECT COUNT(*) as count FROM ${tableName}`,
        );
        const count = parseInt(countResult.rows[0].count);

        console.log(`Table ${tableName}: ${count} rows`);

        if (count === 0 && !tableName.startsWith("__")) {
          console.warn(`⚠️ Table ${tableName} has no data`);
        }
      } catch (error) {
        console.error(`Failed to validate table ${tableName}:`, error);
      }
    }

    // Check for data integrity issues
    await this.checkDataIntegrity();
  }

  private async checkDataIntegrity(): Promise<void> {
    console.log("🔍 Checking data integrity...");

    // Check for orphaned records
    const integrityChecks = [
      {
        name: "Job History without Jobs",
        query: `
          SELECT COUNT(*) as count 
          FROM job_history jh 
          LEFT JOIN jobs j ON jh.job_id = j.id 
          WHERE j.id IS NULL
        `,
      },
      {
        name: "OAuth Tokens without Users",
        query: `
          SELECT COUNT(*) as count 
          FROM oauth_tokens ot 
          LEFT JOIN users u ON ot.user_id = u.id 
          WHERE u.id IS NULL
        `,
      },
      {
        name: "User Sessions without Users",
        query: `
          SELECT COUNT(*) as count 
          FROM user_sessions us 
          LEFT JOIN users u ON us.user_id = u.id 
          WHERE u.id IS NULL
        `,
      },
    ];

    for (const check of integrityChecks) {
      try {
        const result = await this.pool.query(check.query);
        const count = parseInt(result.rows[0].count);

        if (count > 0) {
          console.warn(`⚠️ ${check.name}: ${count} orphaned records found`);
        } else {
          console.log(`✅ ${check.name}: No issues found`);
        }
      } catch (error) {
        console.error(`Failed to run integrity check "${check.name}":`, error);
      }
    }
  }

  async getImportStatus(): Promise<{
    totalTables: number;
    tableRowCounts: Record<string, number>;
    lastImportTime?: Date;
  }> {
    const tables = await this.pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tableRowCounts: Record<string, number> = {};

    for (const table of tables.rows) {
      const tableName = table.table_name;
      const countResult = await this.pool.query(
        `SELECT COUNT(*) as count FROM ${tableName}`,
      );
      tableRowCounts[tableName] = parseInt(countResult.rows[0].count);
    }

    return {
      totalTables: tables.rows.length,
      tableRowCounts,
    };
  }
}

// Export function for easy use
export async function importPostgreSQLData(
  pool: Pool,
  sqlFilePath: string,
  options: ImportOptions = {},
): Promise<ImportResult> {
  const importer = new PostgreSQLImporter(pool, sqlFilePath);
  return await importer.importData(options);
}
```

### Step 3: Migration Orchestration Script

#### scripts/migrate-data.ts

```typescript
import { Pool } from "pg";
import { exportSQLiteData } from "@/lib/database/export-sqlite";
import { importPostgreSQLData } from "@/lib/database/import-postgresql";
import { getAppDatabase } from "@/lib/database/connection";

interface MigrationConfig {
  sqlitePath: string;
  exportPath: string;
  batchSize?: number;
  validateData?: boolean;
  skipErrors?: boolean;
}

async function migrateData(config: MigrationConfig): Promise<void> {
  console.log("🚀 Starting data migration from SQLite to PostgreSQL...");

  try {
    // Step 1: Export from SQLite
    console.log("📦 Step 1: Exporting data from SQLite...");
    await exportSQLiteData(config.sqlitePath, config.exportPath, {
      includeSchema: false,
      batchSize: config.batchSize || 1000,
      outputFormat: "sql",
    });

    const exportSummary = await getExportSummary(config.sqlitePath);
    console.log(
      `✅ Exported ${exportSummary.totalRows} rows from ${exportSummary.totalTables} tables`,
    );

    // Step 2: Import to PostgreSQL
    console.log("📥 Step 2: Importing data to PostgreSQL...");
    const { pool } = getAppDatabase();

    const importResult = await importPostgreSQLData(pool, config.exportPath, {
      batchSize: config.batchSize || 1000,
      validateData: config.validateData !== false,
      skipErrors: config.skipErrors || false,
    });

    // Step 3: Report results
    console.log("\n📊 Migration Results:");
    console.log(`✅ Tables imported: ${importResult.tablesImported}`);
    console.log(`✅ Rows imported: ${importResult.totalRowsImported}`);
    console.log(`⏱️ Duration: ${importResult.duration}ms`);

    if (importResult.errors.length > 0) {
      console.log(`❌ Errors: ${importResult.errors.length}`);
      importResult.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    if (importResult.success) {
      console.log("\n🎉 Data migration completed successfully!");
    } else {
      console.log("\n⚠️ Data migration completed with errors");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Data migration failed:", error);
    process.exit(1);
  }
}

async function getExportSummary(sqlitePath: string): Promise<{
  totalTables: number;
  totalRows: number;
  tableRowCounts: Record<string, number>;
}> {
  const Database = require("better-sqlite3");
  const db = new Database(sqlitePath);

  const tables = db
    .prepare(
      `
    SELECT name 
    FROM sqlite_master 
    WHERE type='table' 
    AND name NOT LIKE 'sqlite_%'
  `,
    )
    .all() as { name: string }[];

  const tableRowCounts: Record<string, number> = {};
  let totalRows = 0;

  for (const table of tables) {
    const count = db
      .prepare(`SELECT COUNT(*) as count FROM ${table.name}`)
      .get() as { count: number };
    tableRowCounts[table.name] = count.count;
    totalRows += count.count;
  }

  db.close();

  return {
    totalTables: tables.length,
    totalRows,
    tableRowCounts,
  };
}

// CLI interface
if (require.main === module) {
  const config: MigrationConfig = {
    sqlitePath: process.argv[2] || "./data/hyperpage.db",
    exportPath: process.argv[3] || "./migration-export.sql",
    batchSize: parseInt(process.argv[4]) || 1000,
    validateData: process.argv[5] !== "false",
    skipErrors: process.argv[6] === "true",
  };

  migrateData(config).catch(console.error);
}

export { migrateData };
```

### Step 4: Data Validation Script

#### scripts/validate-migration.ts

```typescript
import { Pool } from "pg";
import Database from "better-sqlite3";
import { getAppDatabase } from "@/lib/database/connection";

interface ValidationResult {
  tableName: string;
  sqliteCount: number;
  postgresqlCount: number;
  matches: boolean;
  differences: number;
}

async function validateMigration(
  sqlitePath: string,
  options: {
    sampleSize?: number;
    checkIntegrity?: boolean;
  } = {},
): Promise<void> {
  const { sampleSize = 100, checkIntegrity = true } = options;

  console.log("🔍 Validating data migration...");

  try {
    // Connect to both databases
    const sqliteDb = new Database(sqlitePath);
    const { pool } = getAppDatabase();

    // Get table list
    const tables = sqliteDb
      .prepare(
        `
      SELECT name 
      FROM sqlite_master 
      WHERE type='table' 
      AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `,
      )
      .all() as { name: string }[];

    const validationResults: ValidationResult[] = [];

    // Validate each table
    for (const table of tables) {
      console.log(`Validating table: ${table.name}`);

      const sqliteCount = sqliteDb
        .prepare(`SELECT COUNT(*) as count FROM ${table.name}`)
        .get() as { count: number };
      const pgCount = await pool.query(
        `SELECT COUNT(*) as count FROM ${table.name}`,
      );
      const postgresqlCount = parseInt(pgCount.rows[0].count);

      const matches = sqliteCount.count === postgresqlCount;
      const differences = Math.abs(sqliteCount.count - postgresqlCount);

      validationResults.push({
        tableName: table.name,
        sqliteCount: sqliteCount.count,
        postgresqlCount,
        matches,
        differences,
      });

      console.log(
        `  SQLite: ${sqliteCount.count}, PostgreSQL: ${postgresqlCount} ${matches ? "✅" : "❌"}`,
      );

      // Sample data validation for key tables
      if (sampleSize > 0 && (table.name === "jobs" || table.name === "users")) {
        await validateSampleData(sqliteDb, pool, table.name, sampleSize);
      }
    }

    // Data integrity checks
    if (checkIntegrity) {
      await performIntegrityChecks(pool);
    }

    // Summary
    console.log("\n📊 Validation Summary:");
    const totalTables = validationResults.length;
    const matchingTables = validationResults.filter((r) => r.matches).length;
    const totalDifferences = validationResults.reduce(
      (sum, r) => sum + r.differences,
      0,
    );

    console.log(`Total tables: ${totalTables}`);
    console.log(`Matching tables: ${matchingTables}`);
    console.log(`Tables with differences: ${totalTables - matchingTables}`);
    console.log(`Total row differences: ${totalDifferences}`);

    if (totalDifferences === 0) {
      console.log("🎉 Data migration validation passed!");
    } else {
      console.log("⚠️ Data migration validation found differences");
      process.exit(1);
    }

    sqliteDb.close();
    await pool.end();
  } catch (error) {
    console.error("❌ Validation failed:", error);
    process.exit(1);
  }
}

async function validateSampleData(
  sqliteDb: Database.Database,
  pool: Pool,
  tableName: string,
  sampleSize: number,
): Promise<void> {
  // Get sample data from SQLite
  const sqliteSample = sqliteDb
    .prepare(`SELECT * FROM ${tableName} LIMIT ?`)
    .all(sampleSize) as Record<string, unknown>[];

  if (sqliteSample.length === 0) {
    return;
  }

  // Check if same records exist in PostgreSQL
  for (const record of sqliteSample) {
    const id = record.id || record.tool_name || record.session_id;
    if (!id) continue;

    const pgResult = await pool.query(
      `SELECT * FROM ${tableName} WHERE id = $1 OR tool_name = $1 OR session_id = $1`,
      [id],
    );

    if (pgResult.rows.length === 0) {
      console.log(`  ⚠️ Record with ID ${id} not found in PostgreSQL`);
    }
  }
}

async function performIntegrityChecks(pool: Pool): Promise<void> {
  console.log("Performing integrity checks...");

  const checks = [
    {
      name: "Foreign key integrity",
      query: `
        SELECT 
          'job_history' as table_name,
          COUNT(*) as orphaned_count
        FROM job_history jh 
        LEFT JOIN jobs j ON jh.job_id = j.id 
        WHERE j.id IS NULL
        
        UNION ALL
        
        SELECT 
          'oauth_tokens' as table_name,
          COUNT(*) as orphaned_count
        FROM oauth_tokens ot 
        LEFT JOIN users u ON ot.user_id = u.id 
        WHERE u.id IS NULL
      `,
    },
    {
      name: "Data type validation",
      query: `
        SELECT 
          'jobs' as table_name,
          COUNT(*) as invalid_json
        FROM jobs 
        WHERE payload IS NOT NULL 
        AND NOT (payload::text ~ '^[[:space:]]*[{[]')
      `,
    },
  ];

  for (const check of checks) {
    try {
      const result = await pool.query(check.query);

      for (const row of result.rows) {
        const count = parseInt(row.orphaned_count || row.invalid_json || "0");
        if (count > 0) {
          console.log(
            `  ⚠️ ${check.name} - ${row.table_name}: ${count} issues`,
          );
        } else {
          console.log(`  ✅ ${check.name} - ${row.table_name}: OK`);
        }
      }
    } catch (error) {
      console.error(`  ❌ ${check.name}: Failed -`, error);
    }
  }
}

// CLI interface
if (require.main === module) {
  const sqlitePath = process.argv[2] || "./data/hyperpage.db";
  const sampleSize = parseInt(process.argv[3]) || 100;
  const checkIntegrity = process.argv[4] !== "false";

  validateMigration(sqlitePath, { sampleSize, checkIntegrity }).catch(
    console.error,
  );
}

export { validateMigration };
```

## Environment Configuration

### Migration Environment Variables

```env
# Data Migration Settings
SQLITE_DB_PATH=./data/hyperpage.db
MIGRATION_EXPORT_PATH=./migration-export.sql
MIGRATION_BATCH_SIZE=1000
MIGRATION_VALIDATE_DATA=true
MIGRATION_SKIP_ERRORS=false
MIGRATION_SAMPLE_SIZE=100
```

## Usage Examples

### Basic Migration

```bash
# Export and import data
npm run migrate:data

# With custom paths
npm run migrate:data -- ./data/hyperpage.db ./export.sql

# With options
npm run migrate:data -- ./data/hyperpage.db ./export.sql 500 true false
```

### Validation Only

```bash
# Validate existing migration
npm run validate:migration

# With custom SQLite path
npm run validate:migration -- ./data/hyperpage.db 200
```

## Validation Checklist

### Data Export

- [ ] SQLite data export script working
- [ ] All tables exported successfully
- [ ] Data transformation working (timestamps, JSON, booleans)
- [ ] Export file generated correctly

### Data Import

- [ ] PostgreSQL import script working
- [ ] Data imported without errors
- [ ] Row counts match between databases
- [ ] Data integrity maintained

### Validation

- [ ] Sample data validation working
- [ ] Foreign key integrity checks passing
- [ ] Data type validation working
- [ ] Migration summary reporting correctly

## Success Criteria

✅ **All SQLite data exported successfully**  
✅ **Data properly transformed for PostgreSQL**  
✅ **All data imported into PostgreSQL**  
✅ **Row counts match between databases**  
✅ **Data integrity maintained**  
✅ **Validation checks passing**

## Next Phase Prerequisites

- Data migration scripts functional
- Data successfully transferred
- Validation checks passing
- Migration summary generated
- Error handling working

---

**Phase 6 Status**: Ready for Implementation  
**Next**: [Phase 7: Testing & Validation](phase-7-testing.md)
