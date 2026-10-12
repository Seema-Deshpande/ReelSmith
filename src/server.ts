import { createApp } from "./app.js";
import { config } from "./config.js";
import { closeDb } from "./db.js";
import * as storage from "./storage.js";

await storage.init();
const server = createApp().listen(config.port, () => {
  console.log(`Reelsmith listening on http://localhost:${config.port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      closeDb().finally(() => process.exit(0));
    });
  });
}
