import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { FIXTURES_DIR, TEST_DATABASE_URL, TEST_UPLOAD_DIR } from "./env";

// Runs once before all tests. It needs Postgres (psql) and FFmpeg installed.
//   1. make sure the test database exists and has the latest tables
//   2. empty it, so every run starts clean
//   3. make the small test videos

export default function globalSetup() {
  prepareDatabase();
  makeFixtures();
}

// ---------------------------------------------------------------------------

function prepareDatabase() {
  const databaseName = new URL(TEST_DATABASE_URL).pathname.slice(1);

  // Safety: never empty a database that is not clearly a test database.
  if (!databaseName.endsWith("_test")) {
    throw new Error(`Refusing to run tests on "${databaseName}". The test database name must end with _test.`);
  }

  // The "postgres" database is always there, so we can use it to create ours.
  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = "/postgres";

  const exists = execFileSync(
    "psql",
    [adminUrl.href, "-tAc", `SELECT 1 FROM pg_database WHERE datname = '${databaseName}'`],
    { encoding: "utf8" },
  ).trim();
  if (!exists) {
    execFileSync("psql", [adminUrl.href, "-c", `CREATE DATABASE "${databaseName}"`], { stdio: "ignore" });
  }

  // Create or update the tables.
  execFileSync("node", ["scripts/db.mjs", "migrate"], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "ignore",
  });

  // Start clean. Deleting users and jobs also deletes everything that belongs to them.
  execFileSync("psql", [TEST_DATABASE_URL, "-c", "TRUNCATE users, jobs CASCADE"], { stdio: "ignore" });

  // Playwright starts the server before this file runs, and the server creates the upload folder.
  // So empty the folder, but do not delete the folder itself.
  if (fs.existsSync(TEST_UPLOAD_DIR)) {
    for (const entry of fs.readdirSync(TEST_UPLOAD_DIR)) {
      fs.rmSync(path.join(TEST_UPLOAD_DIR, entry), { recursive: true, force: true });
    }
  }
}

// ---------------------------------------------------------------------------

function makeFixtures() {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });

  // 60 second video with sound: the main test video.
  makeVideo("talk.mp4", ["-f", "lavfi", "-i", "testsrc=duration=60:size=320x240:rate=10", "-f", "lavfi", "-i", "sine=duration=60", "-shortest"]);

  // 3 second video with sound: shorter than any preset length.
  makeVideo("short.mp4", ["-f", "lavfi", "-i", "testsrc=duration=3:size=320x240:rate=10", "-f", "lavfi", "-i", "sine=duration=3", "-shortest"]);

  // 20 second video with no sound.
  makeVideo("silent.mp4", ["-f", "lavfi", "-i", "testsrc=duration=20:size=320x240:rate=10"]);

  // A file that is not a video at all.
  fs.writeFileSync(path.join(FIXTURES_DIR, "notvideo.mp4"), randomBytes(20_000));
}

function makeVideo(fileName: string, inputArgs: string[]) {
  const target = path.join(FIXTURES_DIR, fileName);
  if (fs.existsSync(target)) return; // already made on an earlier run

  execFileSync("ffmpeg", ["-v", "error", "-y", ...inputArgs, "-pix_fmt", "yuv420p", "-b:v", "50k", target]);
}
