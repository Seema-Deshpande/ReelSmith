import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { HttpError } from "../helpers/errors.js";
import * as storage from "../helpers/storage.js";

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "not found" });
};

/** Decides which HTTP status and message the client sees for an error. */
function describeError(err: unknown): { status: number; message: string } {
  if (err instanceof HttpError) {
    return { status: err.status, message: err.message };
  }
  if (err instanceof multer.MulterError) {
    const tooLarge = err.code === "LIMIT_FILE_SIZE";
    return { status: tooLarge ? 413 : 400, message: err.message };
  }
  // Express itself reports client mistakes, such as malformed JSON, with a 4xx status.
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === "number" && status >= 400 && status < 500) {
    return { status, message: (err as Error).message };
  }
  // Anything else is our bug: log it, and do not leak details to the client.
  console.error(err);
  return { status: 500, message: "internal error" };
}

/** Last middleware: sends the error as JSON and deletes an upload that was never used. */
export const errorHandler: ErrorRequestHandler = async (err, req, res, _next) => {
  if (req.file) await storage.removeFile(req.file.path).catch(() => {});

  const { status, message } = describeError(err);
  res.status(status).json({ error: message });
};
