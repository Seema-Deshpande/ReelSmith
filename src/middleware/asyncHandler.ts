import type { Request, RequestHandler, Response } from "express";

// Express 4 does not notice when an async function fails.
// This wrapper catches the failure and passes it to the error handler,
// so controllers can simply throw errors.

type Controller = (req: Request, res: Response) => Promise<unknown>;

export function asyncHandler(controller: Controller): RequestHandler {
  return (req, res, next) => {
    controller(req, res).catch(next);
  };
}
