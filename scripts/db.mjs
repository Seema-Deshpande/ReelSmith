// Database helper behind the `npm run db:*` scripts. Usage: node scripts/db.mjs <command>
import { spawnSync } from "node:child_process";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: fall back to variables already set in the shell.
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env first.");
  process.exit(1);
}

const psql = (file) => ["psql", [url, "-v", "ON_ERROR_STOP=1", "-f", file]];
const migrate = (direction) => ["node-pg-migrate", [direction, "-m", "db/migrations"]];

const commands = {
  migrate: migrate("up"), // apply new migrations
  rollback: migrate("down"), // undo the last migration
  seed: psql("db/seed.sql"), // add demo data (dev only)
  unseed: psql("db/unseed.sql"), // remove the demo data
  test: psql("db/tests/smoke.sql"), // check the schema's constraints
};

const command = commands[process.argv[2]];
if (!command) {
  console.error(`Unknown command. Use one of: ${Object.keys(commands).join(", ")}`);
  process.exit(1);
}

const [program, args] = command;
const result = spawnSync(program, args, { stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
