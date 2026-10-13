import express from "express";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { apiRouter } from "./routes/index.js";

// Builds the web app. server.ts starts it.
export function createApp() {
  const app = express();

  // Read JSON request bodies.
  app.use(express.json());

  // Serve the web page from the public/ folder.
  app.use(express.static("public"));

  // All API endpoints start with /api.
  app.use("/api", apiRouter);

  // These two must stay last.
  app.use(notFound); // no route matched: reply 404
  app.use(errorHandler); // something failed: reply with the error

  return app;
}
