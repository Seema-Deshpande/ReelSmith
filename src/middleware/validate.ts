import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";
import { HttpError } from "../errors.js";

/** Checks `data` against `schema`. Returns the cleaned data or throws a 400 listing every problem. */
function parse(schema: ZodTypeAny, data: unknown): unknown {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const problems = result.error.issues.map((issue) =>
    issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message,
  );
  throw HttpError.badRequest(problems.join("; "));
}

/** Validates the request body (or form fields) and replaces req.body with the cleaned data. */
export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    try {
      req.body = parse(schema, req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Validates the URL parameters, such as :id, and replaces req.params with the cleaned data. */
export function validateParams(schema: ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    try {
      req.params = parse(schema, req.params) as typeof req.params;
      next();
    } catch (err) {
      next(err);
    }
  };
}
