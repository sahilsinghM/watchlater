#!/usr/bin/env bash
# WatchLater ingest worker — idempotent VPS installer (issue #34).
# Usage (as root on the VPS):
#   git clone https://github.com/sahilsinghM/watchlater /opt/watchlater   # first time
#   sudo /opt/watchlater/ingest-worker/deploy/install.sh
# Re-running after a `git pull` redeploys the latest code.
set -euo pipefail

REPO_DIR=/opt/watchlater
ENV_FILE=/etc/watchlater/ingest.env
SERVICE=watchlater-ingest

[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo)."; exit 1; }
[ -d "$REPO_DIR/ingest-worker" ] || { echo "Repo not found at $REPO_DIR — clone it there first."; exit 1; }

# 1. Bun, system-wide so systemd can find it at a fixed path.
if ! command -v /usr/local/bin/bun >/dev/null 2>&1; then
  echo "Installing Bun to /usr/local/bin ..."
  curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash
fi

# 2. Service user (no shell, no home login).
id -u watchlater >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin watchlater

# 3. Env file. Never committed; created as a template on first run.
if [ ! -f "$ENV_FILE" ]; then
  mkdir -p /etc/watchlater
  cat > "$ENV_FILE" <<'EOF'
# WatchLater ingest worker secrets — fill in real values, then re-run install.sh
# INGEST_SECRET must equal the INGEST_WORKER_SECRET you set in Vercel.
INGEST_SECRET=REPLACE_WITH_RANDOM_SECRET
SUPABASE_URL=https://uxczumklefbdmxilshro.supabase.co
# sb_secret_... key only — legacy JWT keys are disabled on the project.
SUPABASE_SECRET_KEY=REPLACE_WITH_SB_SECRET_KEY
SUPADATA_API_KEY=REPLACE_WITH_SUPADATA_KEY
ANTHROPIC_API_KEY=REPLACE_WITH_ANTHROPIC_KEY
# Default model is claude-sonnet-4-6 (matches inline). The VPS has no request
# cap, so you MAY opt into a stronger model here:
# ANTHROPIC_MODEL=claude-opus-4-8
PORT=3001
EOF
  chown root:watchlater "$ENV_FILE"; chmod 640 "$ENV_FILE"
  echo ""
  echo ">>> Created $ENV_FILE with placeholders."
  echo ">>> Fill in the real values (suggested INGEST_SECRET: $(head -c 32 /dev/urandom | base64 | tr -d '+/=' | head -c 32))"
  echo ">>> then re-run this script."
  exit 0
fi
if grep -q REPLACE_WITH "$ENV_FILE"; then
  echo "$ENV_FILE still contains REPLACE_WITH placeholders — fill them in, then re-run."
  exit 1
fi

# 4. Dependencies.
cd "$REPO_DIR/ingest-worker"
/usr/local/bin/bun install
chown -R watchlater:watchlater "$REPO_DIR/ingest-worker/node_modules"

# 5. Systemd service.
cp "$REPO_DIR/ingest-worker/deploy/$SERVICE.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable "$SERVICE"
systemctl restart "$SERVICE"

# 6. Health check (localhost — the worker is never exposed directly).
PORT=$(grep -E '^PORT=' "$ENV_FILE" | cut -d= -f2); PORT=${PORT:-3001}
for i in $(seq 1 15); do
  if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    echo ""
    echo "✓ $SERVICE is running and healthy on 127.0.0.1:$PORT"
    echo "Next: put HTTPS in front of it (see deploy/README.md), then set"
    echo "INGEST_WORKER_URL + INGEST_WORKER_SECRET in Vercel and redeploy."
    exit 0
  fi
  sleep 1
done
echo "✗ Worker did not become healthy — check: journalctl -u $SERVICE -n 50"
exit 1
