import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/database/pg-schema.ts",
  out: "./drizzle",
} satisfies Config;
