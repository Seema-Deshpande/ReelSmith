import pg from "pg";
import { config } from "./index.js";

// The shared connection pool. Run SQL with pool.query().
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: config.dbPoolMax,
  connectionTimeoutMillis: 5_000, 
});

pool.on("error", (err) => console.error("Postgres pool error:", err));

// Anything we can run SQL on: the pool, or one connection inside a transaction.
export type Db = Pick<pg.Pool, "query">;

// Run `work` as one all-or-nothing unit. If it throws, every change it made is undone.
export async function withTransaction<T>(work: (db: Db) => Promise<T>): Promise<T> {
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    const result = await work(connection);
    await connection.query("COMMIT");
    return result;
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
