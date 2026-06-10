import { describe, expect, test } from "bun:test";
import { resolveIngestTarget } from "./ingest.functions";

// resolveIngestTarget decides whether ingest runs inline (null) or is dispatched
// to an external worker. It must NEVER fall back to a half-configured worker —
// only both URL + secret together opt into the escape hatch; everything else
// means "process inline in the Vercel function".
describe("resolveIngestTarget", () => {
  test("returns null when no external worker is configured (process inline)", () => {
    expect(resolveIngestTarget({})).toBeNull();
  });

  test("routes to INGEST_WORKER_URL when both URL and secret are configured", () => {
    expect(
      resolveIngestTarget({
        ingestWorkerUrl: "http://localhost:3001",
        ingestWorkerSecret: "dev-secret",
      }),
    ).toEqual({
      url: "http://localhost:3001/ingest",
      authHeader: "dev-secret",
    });
  });

  test("returns null when the worker URL is set but the secret is missing", () => {
    expect(resolveIngestTarget({ ingestWorkerUrl: "http://localhost:3001" })).toBeNull();
  });

  test("returns null when the secret is set but the worker URL is missing", () => {
    expect(resolveIngestTarget({ ingestWorkerSecret: "dev-secret" })).toBeNull();
  });
});
