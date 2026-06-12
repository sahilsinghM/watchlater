#!/usr/bin/env bun
/**
 * Supadata API probe — run before any feature work against the transcript API.
 *
 * Validates (in order):
 *   1. SUPADATA_API_KEY is present
 *   2. api.supadata.ai is reachable from this environment
 *   3. The API key is accepted (not 401/403)
 *   4. The account has quota / credits
 *   5. A live transcript call succeeds and the response schema matches the adapter
 *
 * Usage:
 *   SUPADATA_API_KEY=<key> bun scripts/probe-supadata.ts [youtubeVideoId]
 *
 * The raw response from step 5 is saved to /tmp/supadata-probe-response.json
 * so you can inspect the actual schema returned by the live API.
 *
 * Exit 0 = GO.  Exit 1 = NO-GO (blockers listed at the bottom).
 */

import { writeFileSync } from "node:fs";
import {
  SupadataSyncResponseSchema,
  SupadataAsyncResponseSchema,
  SupadataErrorResponseSchema,
} from "../src/lib/supadata-adapter";

const SUPADATA_BASE = "https://api.supadata.ai/v1";
// A public TED talk with confirmed English captions — reliable probe target.
const TEST_VIDEO_ID = process.argv[2] ?? "8jPQjjsBbIc";

// ─── Result tracking ─────────────────────────────────────────────────────────

type Status = "pass" | "fail" | "warn" | "skip";
type Check = { name: string; status: Status; detail: string };
const checks: Check[] = [];

function pass(name: string, detail: string): void {
  checks.push({ name, status: "pass", detail });
  console.log(`  ✓  ${name}: ${detail}`);
}
function fail(name: string, detail: string): void {
  checks.push({ name, status: "fail", detail });
  console.log(`  ✗  ${name}: ${detail}`);
}
function warn(name: string, detail: string): void {
  checks.push({ name, status: "warn", detail });
  console.log(`  ⚠  ${name}: ${detail}`);
}
function skip(name: string, detail: string): void {
  checks.push({ name, status: "skip", detail });
  console.log(`  -  ${name}: ${detail} (skipped)`);
}

// ─── 1. ENV check ────────────────────────────────────────────────────────────
console.log("\n[1/5] Environment");
const apiKey = process.env.SUPADATA_API_KEY?.trim() ?? "";
if (!apiKey) {
  fail("SUPADATA_API_KEY", "Not set or empty — set the env var and rerun");
} else {
  pass("SUPADATA_API_KEY", `Present (length=${apiKey.length})`);
}

// ─── 2. Network reachability ─────────────────────────────────────────────────
console.log("\n[2/5] Network reachability");
try {
  // Use a cheap HEAD to a URL that will 4xx but not time out.
  // Any HTTP response proves TCP + TLS + DNS all resolved.
  const res = await fetch(`${SUPADATA_BASE}/transcript?url=probe`, {
    method: "HEAD",
    headers: apiKey ? { "x-api-key": apiKey } : {},
    signal: AbortSignal.timeout(6_000),
  });
  pass("Host reachable", `api.supadata.ai responded with HTTP ${res.status}`);
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (/ENOTFOUND|ECONNREFUSED|fetch failed/i.test(msg)) {
    fail(
      "Host reachable",
      `DNS/TCP failure — api.supadata.ai is unreachable from this environment (datacenter IP block?): ${msg}`,
    );
  } else if (/timeout|AbortError/i.test(msg)) {
    fail(
      "Host reachable",
      `Connection timed out — strong signal of datacenter-IP blocking (YouTube does this; Supadata's edge may also rate-limit DCs)`,
    );
  } else {
    warn("Host reachable", `Unexpected network error: ${msg}`);
  }
}

// ─── 3. Auth token ───────────────────────────────────────────────────────────
console.log("\n[3/5] Auth token");
if (!apiKey) {
  skip("Auth", "No API key to test");
} else {
  try {
    // Use a deliberately-invalid video ID so the request is cheap but still
    // exercises the auth path. A 400/404 means the key was accepted; 401/403
    // means it was rejected.
    const res = await fetch(
      `${SUPADATA_BASE}/transcript?${new URLSearchParams({
        url: "https://www.youtube.com/watch?v=PROBE_AUTH_ONLY_XXXX",
        text: "false",
        lang: "en",
        mode: "native",
      })}`,
      { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(10_000) },
    );
    if (res.status === 401) {
      fail("Auth token", "401 Unauthorized — API key is invalid or revoked");
    } else if (res.status === 403) {
      fail("Auth token", "403 Forbidden — key valid but access denied (plan restriction?)");
    } else {
      pass("Auth token", `Key accepted by server (HTTP ${res.status})`);
    }
  } catch (e: unknown) {
    skip("Auth token", `Network error prevented auth check: ${e instanceof Error ? e.message : e}`);
  }
}

// ─── 4. Quota / credits ──────────────────────────────────────────────────────
console.log("\n[4/5] Quota / credits");
if (!apiKey) {
  skip("Quota", "No API key to test");
} else {
  // Supadata's public docs (as of 2026-06) don't expose a /account endpoint,
  // so we probe likely paths and gracefully degrade if none respond.
  const quotaPaths = ["/account", "/me", "/usage", "/credits", "/account/usage"];
  let found = false;

  for (const path of quotaPaths) {
    try {
      const res = await fetch(`${SUPADATA_BASE}${path}`, {
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(5_000),
      });
      if (res.status === 404) continue;
      if (res.status === 401 || res.status === 403) {
        fail("Quota endpoint", `${path} → auth denied (${res.status})`);
        found = true;
        break;
      }
      if (res.ok) {
        const body = (await res.json()) as Record<string, unknown>;
        pass("Quota endpoint", `${path} → ${JSON.stringify(body).slice(0, 140)}`);
        found = true;

        const remaining =
          body.credits ?? body.quota ?? body.remaining ?? body.creditsRemaining ?? body.balance;
        if (remaining !== undefined) {
          if (Number(remaining) === 0) {
            fail("Credits remaining", "Account has 0 credits — transcript calls will fail with 402");
          } else {
            pass("Credits remaining", `${remaining} credits available`);
          }
        }
        break;
      }
    } catch {
      continue;
    }
  }

  if (!found) {
    warn(
      "Quota",
      "No account/quota endpoint found — cannot pre-validate credits. Watch for 402/429 at runtime.",
    );
  }
}

// ─── 5. Live schema capture ───────────────────────────────────────────────────
console.log(`\n[5/5] Live schema capture  (videoId=${TEST_VIDEO_ID})`);

if (!apiKey) {
  skip("Live call", "No API key");
} else {
  let rawCapture: unknown = null;

  try {
    const params = new URLSearchParams({
      url: `https://www.youtube.com/watch?v=${TEST_VIDEO_ID}`,
      text: "false",
      lang: "en",
      mode: "native",
    });

    const startMs = Date.now();
    const res = await fetch(`${SUPADATA_BASE}/transcript?${params}`, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(35_000),
    });
    const elapsed = Date.now() - startMs;

    const rawText = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(rawText);
    } catch {
      fail("Live call", `Non-JSON response (HTTP ${res.status}): ${rawText.slice(0, 200)}`);
      body = rawText;
    }

    rawCapture = {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      elapsedMs: elapsed,
      body,
    };

    if (res.status === 429) {
      fail("Live call", "429 Rate limited — quota exhausted or burst limit hit");
    } else if (res.status === 402) {
      fail("Live call", "402 Payment Required — account has no credits");
    } else if (res.status === 202) {
      // Async job path — validate the 202 body shape
      const parsed = SupadataAsyncResponseSchema.safeParse(body);
      if (parsed.success) {
        pass(
          "Live call (async 202)",
          `jobId=${parsed.data.jobId} — long video queued. Adapter schema: OK`,
        );
        warn(
          "Schema capture (async)",
          "Full segment schema only visible after polling; save /tmp/supadata-probe-response.json and poll manually if needed",
        );
      } else {
        fail(
          "Adapter schema (202)",
          `Schema mismatch: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
        );
      }
    } else if (res.ok) {
      // Sync success — validate against the adapter schema
      const parsed = SupadataSyncResponseSchema.safeParse(body);
      if (parsed.success) {
        const seg0 = Array.isArray(parsed.data.content) ? parsed.data.content[0] : null;
        pass(
          "Live call (sync 200)",
          `lang=${parsed.data.lang ?? "unknown"}, segments=${Array.isArray(parsed.data.content) ? parsed.data.content.length : "string"}, elapsed=${elapsed}ms`,
        );
        pass("Adapter schema (200)", "All required fields present with correct types");
        if (seg0) {
          pass(
            "Segment shape",
            `text="${seg0.text.slice(0, 40)}…", offset=${seg0.offset}ms, duration=${seg0.duration}ms, lang=${seg0.lang ?? "—"}`,
          );
        }
      } else {
        fail(
          "Adapter schema (200)",
          `Schema mismatch on live response: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
        );
        warn(
          "Schema drift",
          "The live API response shape doesn't match the adapter — update SupadataSyncResponseSchema in supadata-adapter.ts",
        );
      }
    } else {
      // Error response — validate the error schema
      const parsed = SupadataErrorResponseSchema.safeParse(body);
      if (parsed.success) {
        fail(
          "Live call",
          `HTTP ${res.status} — error shape OK: ${parsed.data.message ?? parsed.data.error ?? JSON.stringify(parsed.data).slice(0, 100)}`,
        );
      } else {
        fail("Live call", `HTTP ${res.status} — unrecognised error body: ${rawText.slice(0, 200)}`);
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Live call", `Exception: ${msg}`);
  }

  // Always write the raw capture so the user can inspect it
  if (rawCapture !== null) {
    const outPath = "/tmp/supadata-probe-response.json";
    writeFileSync(outPath, JSON.stringify(rawCapture, null, 2));
    console.log(`\n  Raw response → ${outPath}`);
  }
}

// ─── Report ───────────────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(62));
const failures = checks.filter((c) => c.status === "fail");
const warnings = checks.filter((c) => c.status === "warn");
const passes = checks.filter((c) => c.status === "pass");

console.log(
  `\nProbe summary: ${passes.length} pass  ${warnings.length} warn  ${failures.length} FAIL\n`,
);

if (failures.length > 0) {
  console.log("BLOCKERS (resolve before writing feature code):");
  for (const c of failures) console.log(`  ✗  [${c.name}] ${c.detail}`);
}
if (warnings.length > 0) {
  console.log("\nWARNINGS (non-blocking but worth reviewing):");
  for (const c of warnings) console.log(`  ⚠  [${c.name}] ${c.detail}`);
}

console.log(
  failures.length === 0
    ? "\n✓  GO — no external blockers. Safe to build feature code against Supadata.\n"
    : "\n✗  NO-GO — resolve the blockers above before writing feature code.\n",
);

process.exit(failures.length > 0 ? 1 : 0);
