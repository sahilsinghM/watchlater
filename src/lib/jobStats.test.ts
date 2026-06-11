import { describe, expect, test } from "bun:test";
import { aggregateJobStats, type JobStatsRow } from "./jobStats";

// aggregateJobStats turns raw processing_jobs rows into the ops report:
// success rate, duration percentiles, failure-code histogram. Pure — the ops
// script feeds it query results; these tests feed it literals.

function row(partial: Partial<JobStatsRow> & { status: JobStatsRow["status"] }): JobStatsRow {
  return {
    status: partial.status,
    error_code: partial.error_code ?? null,
    created_at: partial.created_at ?? "2026-06-11T10:00:00Z",
    updated_at: partial.updated_at ?? "2026-06-11T10:01:00Z",
  };
}

describe("aggregateJobStats", () => {
  test("counts outcomes and computes the success rate", () => {
    const stats = aggregateJobStats([
      row({ status: "ready" }),
      row({ status: "ready" }),
      row({ status: "ready" }),
      row({ status: "failed", error_code: "NO_CAPTIONS" }),
    ]);
    expect(stats.total).toBe(4);
    expect(stats.succeeded).toBe(3);
    expect(stats.failed).toBe(1);
    expect(stats.successRate).toBeCloseTo(0.75);
  });
});

describe("durations", () => {
  test("p50/p95 come from succeeded jobs only", () => {
    const mk = (sec: number) =>
      row({ status: "ready", created_at: "2026-06-11T10:00:00Z", updated_at: `2026-06-11T10:0${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}Z` });
    // durations: 30s, 60s, 90s, 120s + one failed job that must not count
    const stats = aggregateJobStats([
      mk(30), mk(60), mk(90), mk(120),
      row({ status: "failed", error_code: "TOO_LONG", created_at: "2026-06-11T10:00:00Z", updated_at: "2026-06-11T10:09:00Z" }),
    ]);
    expect(stats.p50Ms).toBe(60_000);
    expect(stats.p95Ms).toBe(120_000);
  });
});

describe("edge windows", () => {
  test("an empty window reports zeros and null percentiles", () => {
    const stats = aggregateJobStats([]);
    expect(stats.total).toBe(0);
    expect(stats.successRate).toBe(0);
    expect(stats.p50Ms).toBeNull();
    expect(stats.failureCodes).toEqual({});
  });

  test("an all-failed window has a 0 success rate and a full histogram", () => {
    const stats = aggregateJobStats([
      row({ status: "failed", error_code: "NO_CAPTIONS" }),
      row({ status: "failed", error_code: "NO_CAPTIONS" }),
      row({ status: "failed", error_code: "GENERATION_FAILURE" }),
      row({ status: "failed", error_code: null }),
    ]);
    expect(stats.successRate).toBe(0);
    expect(stats.failureCodes).toEqual({ NO_CAPTIONS: 2, GENERATION_FAILURE: 1, UNKNOWN: 1 });
  });

  test("in-flight jobs are counted but excluded from the rate", () => {
    const stats = aggregateJobStats([
      row({ status: "generating_lesson" }),
      row({ status: "ready" }),
    ]);
    expect(stats.inFlight).toBe(1);
    expect(stats.successRate).toBe(1);
  });
});
