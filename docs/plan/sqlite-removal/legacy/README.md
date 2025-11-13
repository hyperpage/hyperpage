# Legacy SQLite Schema (Reference Only)

This directory contains a frozen snapshot of the historical SQLite schema used by Hyperpage before the Phase 1 PostgreSQL-only migration.

Files in this folder, including `sqlite-schema.ts`:

- MUST NOT be imported or used by runtime application code
- Exist solely for:
  - Offline analysis
  - Data migration tooling
  - Historical debugging and audit trails

All active code in Phase 1 and beyond must use:

- PostgreSQL as the only runtime database
- `lib/database/pg-schema.ts` as the canonical schema
- `lib/database/connection.ts` Postgres-only helpers for database access
