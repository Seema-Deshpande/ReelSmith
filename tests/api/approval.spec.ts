import { expect, test } from "@playwright/test";
import pg from "pg";
import { TEST_DATABASE_URL } from "../support/env";
import { approve, revise, totalSeconds, uploadAndWait } from "../support/helpers";

// A job that has been processed waits for the user to revise or approve its plan.

test.describe("POST /api/jobs/:id/revise", () => {
  test("makes a new plan version with the length the user asked for", async ({ request }) => {
    const job = await uploadAndWait(request); // 60 s video, so the plan starts at 30 s

    const response = await revise(request, job.id, "make it 15 seconds");

    expect(response.status()).toBe(200);
    const revised = await response.json();
    expect(revised.status).toBe("awaiting_approval");
    expect(revised.plan.version).toBe(2);
    expect(revised.targetDurationS).toBe(15);
    expect(totalSeconds(revised.plan.segments)).toBeLessThanOrEqual(15.1);
  });

  test("understands 'shorter' as half the current length", async ({ request }) => {
    const job = await uploadAndWait(request);

    const revised = await (await revise(request, job.id, "shorter")).json();

    expect(revised.targetDurationS).toBe(15);
  });

  test("turns captions off and remembers it for the next change", async ({ request }) => {
    const job = await uploadAndWait(request);

    const first = await (await revise(request, job.id, "no captions")).json();
    expect(first.plan.captionsOn).toBe(false);

    const second = await (await revise(request, job.id, "make it 20 seconds")).json();
    expect(second.plan.version).toBe(3);
    expect(second.plan.captionsOn).toBe(false); // still off: the user did not ask to change it
    expect(second.targetDurationS).toBe(20);
  });

  test("understands several changes in one message", async ({ request }) => {
    const job = await uploadAndWait(request);

    const revised = await (await revise(request, job.id, "no captions, keep the pauses and use a blurred background")).json();

    expect(revised.plan).toMatchObject({ captionsOn: false, trimSilence: false, framing: "blurred_fit" });
  });

  test("keeps the caption style from the earlier plan", async ({ request }) => {
    const job = await uploadAndWait(request);

    const revised = await (await revise(request, job.id, "make it 15 seconds")).json();

    expect(revised.plan.captionStyle).toEqual(job.plan.captionStyle);
  });

  test("never makes the plan longer than the video", async ({ request }) => {
    const job = await uploadAndWait(request, { file: "short.mp4" }); // 3 s video

    const revised = await (await revise(request, job.id, "make it 50 seconds")).json();

    expect(revised.targetDurationS).toBeCloseTo(3, 0);
  });

  test("never makes the plan longer than the platform allows", async ({ request }) => {
    const job = await uploadAndWait(request, { platform: "shorts" }); // shorts allows 60 s

    const revised = await (await revise(request, job.id, "make it 2 minutes")).json();

    expect(revised.targetDurationS).toBeLessThanOrEqual(60);
  });

  test("explains what it understands when the feedback is unclear, and changes nothing", async ({ request }) => {
    const job = await uploadAndWait(request);

    const response = await revise(request, job.id, "make it pop");

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("make it 15 seconds");

    const unchanged = await (await request.get(`/api/jobs/${job.id}`)).json();
    expect(unchanged.plan.version).toBe(1);
  });

  test("rejects empty feedback", async ({ request }) => {
    const job = await uploadAndWait(request);

    const response = await revise(request, job.id, "   ");

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("feedback");
  });

  test("answers 404 for a job that does not exist", async ({ request }) => {
    const response = await revise(request, "00000000-0000-0000-0000-0000000000ff", "shorter");
    expect(response.status()).toBe(404);
  });

  test("answers 409 for a job that failed", async ({ request }) => {
    const job = await uploadAndWait(request, { file: "notvideo.mp4" });
    expect(job.status).toBe("failed");

    const response = await revise(request, job.id, "shorter");

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toContain("not waiting for approval");
  });

  test("answers 409 once the plan has been approved", async ({ request }) => {
    const job = await uploadAndWait(request);
    await approve(request, job.id);

    const response = await revise(request, job.id, "shorter");

    expect(response.status()).toBe(409);
  });
});

test.describe("POST /api/jobs/:id/approve", () => {
  test("approves the plan and queues the job", async ({ request }) => {
    const job = await uploadAndWait(request);

    const response = await approve(request, job.id);

    expect(response.status()).toBe(200);
    const approved = await response.json();
    expect(approved.status).toBe("queued");
    expect(approved.progress).toBe(0);
    expect(approved.plan.approved).toBe(true);
  });

  test("applies the last switches the user changed", async ({ request }) => {
    const job = await uploadAndWait(request);

    const approved = await (await approve(request, job.id, { captionsOn: false, framing: "blurred_fit" })).json();

    expect(approved.plan).toMatchObject({ captionsOn: false, framing: "blurred_fit", trimSilence: true });
  });

  test("approves the newest plan version", async ({ request }) => {
    const job = await uploadAndWait(request);
    await revise(request, job.id, "make it 15 seconds");

    const approved = await (await approve(request, job.id)).json();

    expect(approved.plan.version).toBe(2);
    expect(approved.plan.approved).toBe(true);
  });

  test("answers 409 when it is approved a second time", async ({ request }) => {
    const job = await uploadAndWait(request);
    await approve(request, job.id);

    const response = await approve(request, job.id);

    expect(response.status()).toBe(409);
  });

  test("looks at the job again after waiting for its lock, so a change made meanwhile is respected", async ({ request }) => {
    const job = await uploadAndWait(request);

    // Another database session is halfway through changing the job: it holds the job's row lock
    // and has already moved the job on to "rendering".
    const otherSession = new pg.Client({ connectionString: TEST_DATABASE_URL });
    await otherSession.connect();
    await otherSession.query("BEGIN");
    await otherSession.query("SELECT id FROM jobs WHERE id = $1 FOR UPDATE", [job.id]);
    await otherSession.query("UPDATE jobs SET status = 'rendering' WHERE id = $1", [job.id]);

    try {
      let answered = false;
      const approval = approve(request, job.id).then((response) => {
        answered = true;
        return response;
      });

      // The approval has to wait for the other session. It must not answer yet.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      expect(answered).toBe(false);

      // When the other session finishes, the approval sees the new status and refuses.
      // Without the lock it would use the old status and wrongly succeed.
      await otherSession.query("COMMIT");
      expect((await approval).status()).toBe(409);
    } finally {
      await otherSession.end();
    }
  });

  test("answers 409 for a job that failed", async ({ request }) => {
    const job = await uploadAndWait(request, { file: "notvideo.mp4" });

    const response = await approve(request, job.id);

    expect(response.status()).toBe(409);
  });

  test("rejects a switch with a value we do not support", async ({ request }) => {
    const job = await uploadAndWait(request);

    const response = await approve(request, job.id, { framing: "zoom" });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("framing");
  });

  test("answers 404 for a job that does not exist", async ({ request }) => {
    const response = await approve(request, "00000000-0000-0000-0000-0000000000ff");
    expect(response.status()).toBe(404);
  });

  test("answers 400 for an id that is not valid", async ({ request }) => {
    const response = await approve(request, "not-an-id");
    expect(response.status()).toBe(400);
  });
});
