import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// Proxy PostHog analytics through our domain so ad blockers don't drop events.
// /ingest/static/** and /ingest/array/** → us-assets.i.posthog.com
// /ingest/**                              → us.i.posthog.com
async function posthogProxy(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/ingest/, "") + url.search;
  const isAsset = path.startsWith("/static") || path.startsWith("/array");
  const target = isAsset
    ? `https://us-assets.i.posthog.com${path}`
    : `https://us.i.posthog.com${path}`;
  // Whitelist only headers PostHog needs — never forward Cookie/Authorization/
  // app-internal auth headers to a third-party origin. Deliberately drop
  // accept-encoding: forwarding it made PostHog reply gzip while the body
  // reached the browser decompressed but still labeled content-encoding: gzip
  // → ERR_CONTENT_DECODING_FAILED. Letting fetch negotiate lets us read a
  // decoded body and return plain bytes; the platform compresses once.
  const safe = new Headers();
  for (const k of ["content-type", "content-length", "user-agent", "accept"]) {
    const v = request.headers.get(k);
    if (v) safe.set(k, v);
  }
  safe.set("host", new URL(target).host);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const upstream = await fetch(target, {
    method: request.method,
    headers: safe,
    body: hasBody ? request.body : undefined,
    // @ts-expect-error duplex is required for streaming bodies in some runtimes
    duplex: "half",
  });
  const body = await upstream.arrayBuffer(); // decoded by fetch
  const headers = new Headers();
  for (const k of ["content-type", "cache-control"]) {
    const v = upstream.headers.get(k);
    if (v) headers.set(k, v);
  }
  return new Response(body, { status: upstream.status, headers });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/ingest/")) {
      return posthogProxy(request);
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
