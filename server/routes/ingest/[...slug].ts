import { defineEventHandler, proxyRequest } from "h3";

// Proxy PostHog events through our domain to bypass ad blockers.
// /ingest/static/** and /ingest/array/** → us-assets.i.posthog.com
// /ingest/**                              → us.i.posthog.com
export default defineEventHandler(async (event) => {
  const path = event.path.replace(/^\/ingest/, "");
  const isAsset = path.startsWith("/static") || path.startsWith("/array");
  const target = isAsset
    ? `https://us-assets.i.posthog.com${path}`
    : `https://us.i.posthog.com${path}`;
  return proxyRequest(event, target);
});
