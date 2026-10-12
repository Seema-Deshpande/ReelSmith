import { Router } from "express";
import * as jobsController from "../controllers/jobs.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { uploadVideo } from "../middleware/upload.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import { createJobBodySchema, jobParamsSchema } from "../schemas/job.schema.js";

export const jobsRouter = Router();

// Each route reads top to bottom: the steps that run, in order.
// uploadVideo comes first because form fields are only available after it reads the upload.
jobsRouter.post("/", uploadVideo, validateBody(createJobBodySchema), asyncHandler(jobsController.createJob));
jobsRouter.get("/:id", validateParams(jobParamsSchema), asyncHandler(jobsController.getJob));
