#!/usr/bin/env bash
#
# OTA auto-deploy for the hearth-hollow app on forge.
#
# Polls GitHub for the latest commit on main (the repo is public — no auth
# needed) and, when it changes, downloads the source tarball, overlays the
# forge-only files (Dockerfile, .dockerignore, .env.production — forge keeps
# these; main doesn't have them), rebuilds the app image, and restarts ONLY
# the app service. Rolls back to the previous image if the app doesn't come
# back healthy. A no-change poll costs one small API request.
#
# Install (as root on forge):
#   cp deploy/forge-autodeploy.sh /opt/stacks/hearthhollow/autodeploy.sh
#   chmod +x /opt/stacks/hearthhollow/autodeploy.sh
#   crontab: */5 * * * * /opt/stacks/hearthhollow/autodeploy.sh
#
# Deliberately lives OUTSIDE the app/ dir so source swaps never clobber it.
# If the repo is ever made private this stops working (GitHub returns 404);
# the log will show it — switch to a token or back to manual tarballs then.

set -u -o pipefail

STACK_DIR="/opt/stacks/hearthhollow"
APP_DIR="$STACK_DIR/app"
STATE_FILE="$STACK_DIR/.last-deployed-sha"
LOCK_FILE="$STACK_DIR/.autodeploy.lock"
LOG_FILE="/var/log/hearthhollow-autodeploy.log"
REPO="HearthandHollow/hearth-hollow"
BRANCH="main"
HEALTH_URL="http://localhost:3005/"
IMAGE="hearthhollow-app"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG_FILE"; }

# One run at a time; a build takes minutes and cron fires every five.
exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

# --- 1. What's the latest commit on main? -----------------------------------
latest_sha=$(curl -fsS --max-time 30 \
  -H "Accept: application/vnd.github.sha" \
  "https://api.github.com/repos/$REPO/commits/$BRANCH" 2>>"$LOG_FILE")
if [ -z "${latest_sha:-}" ] || ! echo "$latest_sha" | grep -Eq '^[0-9a-f]{40}$'; then
  log "poll failed: could not read latest $BRANCH sha (repo private or GitHub unreachable?)"
  exit 1
fi

current_sha=$(cat "$STATE_FILE" 2>/dev/null || echo "none")
[ "$latest_sha" = "$current_sha" ] && exit 0

log "new commit on $BRANCH: $current_sha -> $latest_sha — deploying"

# --- 2. Fetch + unpack the source -------------------------------------------
work=$(mktemp -d "$STACK_DIR/.deploy.XXXXXX") || { log "mktemp failed"; exit 1; }
cleanup() { rm -rf "$work"; }
trap cleanup EXIT

if ! curl -fsSL --max-time 120 \
  "https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH" \
  | tar -xz -C "$work" --strip-components=1; then
  log "tarball download/extract failed"
  exit 1
fi

# Overlay the forge-only files the tarball doesn't contain.
for f in Dockerfile .dockerignore .env.production; do
  if [ -f "$APP_DIR/$f" ]; then
    cp "$APP_DIR/$f" "$work/$f"
  else
    log "WARNING: expected forge-only file $APP_DIR/$f is missing"
  fi
done

# --- 3. Build the new image (keep the old one for rollback) ------------------
docker tag "$IMAGE:latest" "$IMAGE:prev" 2>/dev/null || true

vapid_key=$(grep '^NEXT_PUBLIC_VAPID_PUBLIC_KEY=' "$STACK_DIR/.env.app" | cut -d= -f2-)
if ! docker build -t "$IMAGE:latest" \
  --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY="$vapid_key" \
  "$work" >> "$LOG_FILE" 2>&1; then
  log "docker build FAILED for $latest_sha — live site untouched"
  docker tag "$IMAGE:prev" "$IMAGE:latest" 2>/dev/null || true
  exit 1
fi

# --- 4. Swap the source dir + restart the app service ------------------------
ts=$(date +%s)
mv "$APP_DIR" "$STACK_DIR/app.old.$ts"
mv "$work" "$APP_DIR"
trap - EXIT

(cd "$STACK_DIR" && docker compose up -d app >> "$LOG_FILE" 2>&1)

# --- 5. Health check, roll back if the app didn't come up --------------------
healthy=""
for i in $(seq 1 12); do
  sleep 5
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTH_URL" || echo 000)
  if [ "$code" = "200" ]; then healthy=yes; break; fi
done

if [ -z "$healthy" ]; then
  log "health check FAILED after deploy of $latest_sha — rolling back to previous image"
  docker tag "$IMAGE:prev" "$IMAGE:latest"
  (cd "$STACK_DIR" && docker compose up -d app >> "$LOG_FILE" 2>&1)
  # Restore the previous source dir so the next poll retries cleanly.
  rm -rf "$STACK_DIR/app.failed.$ts"
  mv "$APP_DIR" "$STACK_DIR/app.failed.$ts"
  mv "$STACK_DIR/app.old.$ts" "$APP_DIR"
  exit 1
fi

echo "$latest_sha" > "$STATE_FILE"
log "deployed $latest_sha OK (health 200)"

# Keep only the two most recent app.old backups.
ls -dt "$STACK_DIR"/app.old.* 2>/dev/null | tail -n +3 | xargs -r rm -rf
exit 0
