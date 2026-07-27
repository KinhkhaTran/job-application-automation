import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  // In test / build environments without a real DB, we skip connection.
  // Real queries will fail if DATABASE_URL is absent — set it before running the app.
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL environment variable is required in production");
  }
}

const sql = process.env.DATABASE_URL
  ? neon(process.env.DATABASE_URL)
  : null;

export const db = sql
  ? drizzle(sql, { schema })
  : (null as unknown as ReturnType<typeof drizzle>);

export * from "./schema";
