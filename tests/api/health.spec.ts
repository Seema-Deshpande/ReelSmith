import { expect, test } from "@playwright/test";

test("health check answers ok", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
});

test("an unknown URL answers 404 with a JSON error", async ({ request }) => {
  const response = await request.get("/api/does-not-exist");
  expect(response.status()).toBe(404);
  expect(await response.json()).toEqual({ error: "not found" });
});
