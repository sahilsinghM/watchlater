import { PostHog } from "posthog-node";
import { getServerConfig } from "./config.server";

let _client: PostHog | null = null;

export function getPostHogServer(): PostHog | null {
  if (_client) return _client;
  const { posthogKey, posthogHost } = getServerConfig();
  if (!posthogKey) return null;
  _client = new PostHog(posthogKey, {
    host: posthogHost ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  return _client;
}

export async function shutdownPostHogServer(): Promise<void> {
  if (_client) await _client.shutdown();
}
