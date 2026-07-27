import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Standard PostgreSQL connection via postgres.js. Works with any Postgres
// provider that hands out a DATABASE_URL — including Supabase (direct,
// session pooler, or transaction pooler). See .env.example for the exact
// Supabase connection-string formats.

if (!process.env.DATABASE_URL) {
  // In test / build environments without a real DB, we skip connection.
  // Real queries will fail if DATABASE_URL is absent — set it before running the app.
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL environment variable is required in production");
  }
}

const client = process.env.DATABASE_URL
  ? postgres(process.env.DATABASE_URL, {
      // Supabase's transaction pooler (port 6543, PgBouncer) does not support
      // prepared statements; disabling them keeps every connection mode working.
      prepare: false,
      // Serverless-friendly: one connection per instance.
      max: 1,
    })
  : null;

export const db = client
  ? drizzle(client, { schema })
  : (null as unknown as ReturnType<typeof drizzle>);

/** True when a real database connection is configured. */
export const hasDb = client !== null;

export * from "./schema";
