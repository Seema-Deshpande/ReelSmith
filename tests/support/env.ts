// Settings shared by the Playwright config, the setup file and the tests.

// The tests use their own database, so your development data is never touched.
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://localhost/reelsmith_test";

export const TEST_PORT = 3100;
export const TEST_UPLOAD_DIR = ".test-uploads";
export const FIXTURES_DIR = "tests/.fixtures";

// The server in the tests rejects uploads bigger than this (see playwright.config.ts).
export const TEST_MAX_UPLOAD_MB = 5;
