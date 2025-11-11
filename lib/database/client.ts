import { Pool } from "pg";
import logger from "@/lib/logger";

let pool: Pool | null = null;

export function getPgPool(): Pool {
  if (!pool) {
    const connectionString =
      process.env.DATABASE_URL ??
      "postgres://hyperpage:hyperpage@localhost:5432/hyperpage";

    pool = new Pool({
      connectionString,
      max: Number(process.env.PGPOOL_MAX || 10),
      idleTimeoutMillis: Number(process.env.PGPOOL_IDLE_TIMEOUT_MS || 30000),
      connectionTimeoutMillis: Number(
        process.env.PGPOOL_CONNECTION_TIMEOUT_MS || 5000,
      ),
    });

    pool.on("error", (err) => {
      logger.error("PostgreSQL pool error", {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    });
  }

  return pool;
}

export async function assertPostgresConnection(): Promise<void> {
  const client = await getPgPool().connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
}
