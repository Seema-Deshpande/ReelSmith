import { z } from "zod";
import { PLATFORMS, PRESETS } from "../config/presets.js";

// Form fields of POST /api/jobs. The edit-plan schema is added with the planner.

// An optional number of seconds. An empty form field counts as "not given".
const optionalSeconds = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.coerce.number({ invalid_type_error: "must be a number of seconds" }).positive().optional(),
);

export const createJobBodySchema = z
  .object({
    prompt: z.string().trim().min(1, "prompt is required").max(1000),
    platform: z.enum(PLATFORMS),
    language: z
      .string()
      .regex(/^[a-z]{2}(-[A-Z]{2})?$/, "use a code like en or en-US")
      .optional(),
    targetDurationS: optionalSeconds, // how long the output should be; chosen for the user if missing
  })
  .superRefine((fields, context) => {
    const max = PRESETS[fields.platform].maxDurationS;
    if (fields.targetDurationS !== undefined && fields.targetDurationS > max) {
      context.addIssue({
        code: "custom",
        path: ["targetDurationS"],
        message: `${fields.platform} allows at most ${max} seconds`,
      });
    }
  });
export type CreateJobInput = z.infer<typeof createJobBodySchema>;

export const jobParamsSchema = z.object({
  id: z.string().uuid("invalid job id"),
});
