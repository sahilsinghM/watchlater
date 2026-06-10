# Bun ingest worker — transcript fetch (via Supadata) + LLM generation + Supabase write.
# Runs as a long-lived HTTP server; background processing continues after the
# 202 response, so this must run as a persistent container (not per-request).
FROM oven/bun:1.3

WORKDIR /app

# Install deps first for better layer caching. No lockfile is committed, so a
# plain install is used (the worker has only @supabase/supabase-js + zod).
COPY package.json ./
RUN bun install --production

COPY . .

ENV PORT=3001
EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
