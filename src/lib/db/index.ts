import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Standard PostgreSQL connection via postgres.js. Works with any Postgres
// provider that hands out a DATABASE_URL — including Supabase (direct,
// session pooler, or transaction pooler). See .env.example for the exact
// Supabase connection-string formats.

const client = process.env.DATABASE_URL
  ? postgres(process.env.DATABASE_URL, {
      // Supabase's transaction pooler (port 6543, PgBouncer) does not support
      // prepared statements; disabling them keeps every connection mode working.
      prepare: false,
      // Serverless-friendly: one connection per instance.
      max: 1,
    })
  : null;

// Without DATABASE_URL (tests, builds, the sample-data dashboard) importing
// this module is fine; any actual query throws a clear error instead of
// failing at import time. Callers should gate DB access on `hasDb`.
const unconfigured = new Proxy(
  {},
  {
    get() {
      throw new Error(
        "DATABASE_URL is not configured — set it before running database queries"
      );
    },
  }
);

export const db = client
  ? drizzle(client, { schema })
  : (unconfigured as ReturnType<typeof drizzle>);

/** True when a real database connection is configured. */
export const hasDb = client !== null;

export * from "./schema";
