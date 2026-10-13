import type { Request, Response } from "express";
import { HttpError } from "../helpers/errors.js";
import type { CreateJobInput } from "../schemas/job.schema.js";
import * as jobsService from "../services/jobs.service.js";

// Controllers only deal with the web request and response.
// The real work happens in the service.

// POST /api/jobs: create a job from an uploaded video.
export async function createJob(req: Request, res: Response) {
  const video = req.file;
  if (!video) {
    throw HttpError.badRequest("video file is required");
  }

  const input = req.body as CreateJobInput; // already checked by the validate middleware
  const job = await jobsService.createJob(input, video.path);

  res.status(201).json(job);
}

// GET /api/jobs/:id: return one job.
export async function getJob(req: Request, res: Response) {
  const id = req.params.id as string; // already checked by the validate middleware
  const job = await jobsService.getJob(id);

  res.json(job);
}
