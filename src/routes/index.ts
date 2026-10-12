import { Router } from "express";
import { jobsRouter } from "./jobs.routes.js";

/** Mounted at /api. */
export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true });
});
apiRouter.use("/jobs", jobsRouter);
