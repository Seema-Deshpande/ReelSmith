import type { Request, Response } from "express";
import { HttpError } from "../helpers/errors.js";
import type { ApproveInput, CreateJobInput, ReviseInput } from "../schemas/job.schema.js";
import * as approvalService from "../services/approval.service.js";
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

// POST /api/jobs/:id/revise: change the plan from plain-language feedback.
export async function reviseJob(req: Request, res: Response) {
  const id = req.params.id as string; // already checked by the validate middleware
  const { feedback } = req.body as ReviseInput;

  res.json(await approvalService.reviseJob(id, feedback));
}

// POST /api/jobs/:id/approve: accept the plan so it can be rendered.
export async function approveJob(req: Request, res: Response) {
  const id = req.params.id as string;
  const toggles = req.body as ApproveInput;

  res.json(await approvalService.approveJob(id, toggles));
}
