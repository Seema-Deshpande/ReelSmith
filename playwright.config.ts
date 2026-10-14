import { defineConfig } from "@playwright/test";
import { TEST_DATABASE_URL, TEST_MAX_UPLOAD_MB, TEST_PORT, TEST_UPLOAD_DIR } from "./tests/support/env";

// API tests: they call the real server over HTTP. No browser is needed.
// Run them with: npm test
export default defineConfig({
  testDir: "./tests/api",
  globalSetup: "./tests/support/globalSetup.ts",
  globalTeardown: "./tests/support/globalTeardown.ts",
  workers: 1, // the tests share one database, so run them one at a time
  reporter: "list",
  use: {
    baseURL: `http://localhost:${TEST_PORT}`,
  },

  // Starts the server for the tests, with its own database, port and upload folder.
  webServer: {
    command: "npx tsx src/server.ts",
    url: `http://localhost:${TEST_PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 30_000,
    stderr: "pipe",
    env: {
      PORT: String(TEST_PORT),
      DATABASE_URL: TEST_DATABASE_URL,
      UPLOAD_DIR: TEST_UPLOAD_DIR,
      MAX_UPLOAD_MB: String(TEST_MAX_UPLOAD_MB),
      JOB_TTL_HOURS: "1",
      TRANSCRIBE_PROVIDER: "mock", // free and repeatable
      PLANNER_PROVIDER: "heuristic",
    },
  },
});
