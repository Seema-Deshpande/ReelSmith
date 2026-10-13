import pg from "pg";
import { config } from "./index.js";

// The shared connection pool. Run SQL with pool.query().
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: config.dbPoolMax,
  connectionTimeoutMillis: 5_000, 
});

pool.on("error", (err) => console.error("Postgres pool error:", err));

export async function closeDb(): Promise<void> {
  await pool.end();
}
