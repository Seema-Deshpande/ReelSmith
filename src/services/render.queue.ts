import { renderJob } from "./render.service.js";

// A waiting line for renders. A render uses a lot of the computer, so only one runs at a time,
// in the order the jobs were approved. This lives in the server's memory.
// To run renders on separate machines later, replace this file with a real queue (BullMQ and Redis).

let lastRender: Promise<void> = Promise.resolve();

// Adds a job to the end of the line and returns at once. It does not wait for the render.
export function enqueueRender(jobId: string) {
  lastRender = lastRender
    .then(() => renderJob(jobId))
    .catch((error) => console.error(`Render crashed for job ${jobId}:`, error));
}
