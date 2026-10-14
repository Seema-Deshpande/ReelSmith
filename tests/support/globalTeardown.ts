import fs from "node:fs";
import { TEST_UPLOAD_DIR } from "./env";

// Runs once after all tests: remove the files the test server saved.
// The test database is kept so you can look at it if a test failed.
export default function globalTeardown() {
  fs.rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });
}
