import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { closeDb } from "./config/database.js";
import * as storage from "./helpers/storage.js";

await storage.init();

const server = createApp().listen(
  config.port, () => 
    console.log(`Reelsmith running at http://localhost:${config.port}`)
);


function shutdown() {
  server.close(async () => {
    await closeDb();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
