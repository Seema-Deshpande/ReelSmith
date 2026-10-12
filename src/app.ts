import express from "express";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { apiRouter } from "./routes/index.js";

/** Builds the Express app without starting it, so tests can use it directly. */
export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static("public"));
  app.use("/api", apiRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
