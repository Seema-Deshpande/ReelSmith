/** An error that maps directly to an HTTP response. Anything else becomes a 500. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }

  static badRequest(message: string) {
    return new HttpError(400, message);
  }

  static notFound(message: string) {
    return new HttpError(404, message);
  }

  // The request is fine, but it does not fit the job's current state (for example, approving twice).
  static conflict(message: string) {
    return new HttpError(409, message);
  }
}
