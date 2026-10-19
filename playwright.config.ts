import { defineConfig } from "@playwright/test";
import {
  LOCAL_WHISPER_PORT,
  TEST_DATABASE_URL,
  TEST_MAX_UPLOAD_MB,
  TEST_PORT,
  TEST_UPLOAD_DIR,
} from "./tests/support/env";

// API tests: they call the real server over HTTP. No browser is needed.
// Run them with: npm test

// The settings both test servers share. Each gets its own database name, port and upload folder.
function serverEnv(port: number, transcribeProvider: string) {
  return {
    PORT: String(port),
    DATABASE_URL: TEST_DATABASE_URL,
    UPLOAD_DIR: TEST_UPLOAD_DIR,
    MAX_UPLOAD_MB: String(TEST_MAX_UPLOAD_MB),
    JOB_TTL_HOURS: "1",
    TRANSCRIBE_PROVIDER: transcribeProvider,
    PLANNER_PROVIDER: "heuristic",
  };
}

export default defineConfig({
  testDir: "./tests/api",
  globalSetup: "./tests/support/globalSetup.ts",
  globalTeardown: "./tests/support/globalTeardown.ts",
  workers: 1, // the tests share one database, so run them one at a time
  reporter: "list",

  // Two groups of tests, each talking to its own server.
  projects: [
    {
      name: "api", // everything except the real-speech tests; uses the free mock transcript
      testIgnore: /whisper-local/,
      use: { baseURL: `http://localhost:${TEST_PORT}` },
    },
    {
      name: "whisper-local", // real speech through local Whisper; skipped if it is not set up
      testMatch: /whisper-local/,
      use: { baseURL: `http://localhost:${LOCAL_WHISPER_PORT}` },
    },
  ],

  webServer: [
    {
      command: "npx tsx src/server.ts",
      url: `http://localhost:${TEST_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      stderr: "pipe",
      env: serverEnv(TEST_PORT, "mock"),
    },
    {
      command: "npx tsx src/server.ts",
      url: `http://localhost:${LOCAL_WHISPER_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      stderr: "pipe",
      env: serverEnv(LOCAL_WHISPER_PORT, "local"),
    },
  ],
});
