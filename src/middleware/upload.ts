import { randomUUID } from "node:crypto";
import multer from "multer";
import { config } from "../config.js";
import { HttpError } from "../errors.js";

// Writes the video to a temp name inside the upload dir; the service moves it into the job's folder.
const uploader = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, config.uploadDir),
    filename: (_req, _file, cb) => cb(null, `tmp-${randomUUID()}`),
  }),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("video/")) cb(null, true);
    else cb(HttpError.badRequest("video must be a video file"));
  },
});

export const uploadVideo = uploader.single("video");
