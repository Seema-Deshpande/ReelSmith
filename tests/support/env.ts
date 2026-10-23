// Settings shared by the Playwright config, the setup file and the tests.

// The tests use their own database, so your development data is never touched.
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://localhost/reelsmith_test";

export const TEST_PORT = 3100;
export const TEST_UPLOAD_DIR = ".test-uploads";
export const TEST_OUTPUT_DIR = ".test-outputs";
export const FIXTURES_DIR = "tests/.fixtures";

// The server in the tests rejects uploads bigger than this (see playwright.config.ts).
export const TEST_MAX_UPLOAD_MB = 5;

// The sample video with real speech is saved in git here (made by npm run make:test-video).
export const ASSETS_DIR = "tests/assets";

// A second test server that uses local Whisper (free), for the real-speech tests.
export const LOCAL_WHISPER_PORT = 3101;
export const LOCAL_WHISPER_MODEL = "models/ggml-base.bin";
