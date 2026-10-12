import { z } from "zod";
import { PLATFORMS } from "../presets.js";

// Form fields of POST /api/jobs. The edit-plan schema is added with the planner.
export const createJobBodySchema = z.object({
  prompt: z.string().trim().min(1, "prompt is required").max(1000),
  platform: z.enum(PLATFORMS),
  language: z
    .string()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, "use a code like en or en-US")
    .optional(),
});
export type CreateJobInput = z.infer<typeof createJobBodySchema>;

export const jobParamsSchema = z.object({
  id: z.string().uuid("invalid job id"),
});
