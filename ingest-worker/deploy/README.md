# Deploying the ingest worker to a VPS (issue #34)

Everything is scripted — the VPS never generates code. Three steps on the box,
one flip in Vercel.

## 1. Install (on the VPS, as root)

```bash
git clone https://github.com/sahilsinghM/watchlater /opt/watchlater
sudo /opt/watchlater/ingest-worker/deploy/install.sh   # creates /etc/watchlater/ingest.env template, exits
sudo nano /etc/watchlater/ingest.env                   # paste real secrets (script suggests an INGEST_SECRET)
sudo /opt/watchlater/ingest-worker/deploy/install.sh   # installs bun + systemd service, health-checks
```

Re-deploy after code changes:

```bash
cd /opt/watchlater && git pull && sudo ingest-worker/deploy/install.sh
```

Logs: `journalctl -u watchlater-ingest -f`

## 2. HTTPS ingress (pick one)

The worker binds localhost only — never expose port 3001 directly.

**Option A — Caddy + a subdomain you own** (automatic Let's Encrypt):

```bash
sudo apt install -y caddy
# /etc/caddy/Caddyfile:
#   ingest.yourdomain.com {
#       reverse_proxy 127.0.0.1:3001
#   }
sudo systemctl reload caddy
# DNS: A record for ingest.yourdomain.com -> VPS IP. Firewall: allow 80,443 + SSH.
```

**Option B — Cloudflare Tunnel** (no open ports, no domain needed on the box):

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cf.deb && sudo dpkg -i /tmp/cf.deb
cloudflared tunnel login
cloudflared tunnel create watchlater-ingest
cloudflared tunnel route dns watchlater-ingest ingest.yourdomain.com
# config: tunnel -> http://127.0.0.1:3001 ; then:
sudo cloudflared service install
```

Verify from anywhere: `curl https://<public-url>/health` → `{"ok":true}`

## 3. Flip production to the worker (from your laptop)

```bash
vercel env add INGEST_WORKER_URL production      # https://<public-url>  (no trailing slash, no /ingest)
vercel env add INGEST_WORKER_SECRET production   # same value as INGEST_SECRET on the VPS
git commit --allow-empty -m "redeploy: flip ingest to VPS worker" && git push
```

Verify end-to-end: paste a fresh captioned video on production, confirm the
job row goes `ready` in Supabase and `journalctl -u watchlater-ingest` shows
the build. **Rollback at any time:** remove both env vars and redeploy —
production instantly returns to the proven inline path.

## Notes

- Dispatch contract: Vercel POSTs `{youtubeId, jobId}` to `<url>/ingest` with
  `Authorization: Bearer <secret>`; the worker acks 202 and processes in the
  background with no time limit, writing status + lesson to Supabase.
- The worker mirrors the inline pipeline (12h cap, full-transcript prompting,
  Sonnet 4.6 + thinking disabled, 45s job heartbeat, server-owned video
  facts). Keep `ingest-worker/src/` in sync with `src/lib/` when the inline
  pipeline changes.
- Smoke test transcripts on the box: `cd /opt/watchlater/ingest-worker && bun run probe`
