import { expect, test } from "@playwright/test";
import { uploadAndWait } from "../support/helpers";

test.describe("GET /api/jobs/:id", () => {
  test("returns the job with all the expected fields", async ({ request }) => {
    const created = await uploadAndWait(request, { prompt: "my prompt", platform: "tiktok", language: "en" });

    const response = await request.get(`/api/jobs/${created.id}`);
    expect(response.status()).toBe(200);

    const job = await response.json();
    expect(job).toMatchObject({
      id: created.id,
      prompt: "my prompt",
      platform: "tiktok",
      language: "en",
      estimate: null,
      output: null, // nothing has been rendered yet
    });
    expect(new Date(job.expiresAt).getTime()).toBeGreaterThan(new Date(job.createdAt).getTime());
  });

  test("answers 400 for an id that is not a valid id", async ({ request }) => {
    const response = await request.get("/api/jobs/not-an-id");

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("invalid job id");
  });

  test("answers 404 for a job that does not exist", async ({ request }) => {
    const response = await request.get("/api/jobs/00000000-0000-0000-0000-0000000000ff");

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: "job not found" });
  });
});
