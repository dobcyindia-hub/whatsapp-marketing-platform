import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/database/schema";
import * as relations from "@/database/relations";

const globalForDb = globalThis as unknown as { _pg?: ReturnType<typeof postgres> };

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const client =
  globalForDb._pg ?? postgres(connectionString, { max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDb._pg = client;
}

export const db = drizzle(client, { schema: { ...schema, ...relations } });
