import type { Request, Response } from "express";
import { HttpError } from "../errors.js";
import type { CreateJobInput } from "../schemas/job.schema.js";
import * as jobsService from "../services/jobs.service.js";

// HTTP only: read the request, call the service, write the response.

export async function createJob(req: Request, res: Response): Promise<void> {
  if (!req.file) throw HttpError.badRequest("video file is required");
  const created = await jobsService.createJob(req.body as CreateJobInput, req.file.path);
  res.status(201).json(created);
}

export async function getJob(req: Request, res: Response): Promise<void> {
  res.json(await jobsService.getJob(req.params.id as string));
}
