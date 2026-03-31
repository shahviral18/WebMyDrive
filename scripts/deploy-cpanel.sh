#!/usr/bin/env bash
# deploy-cpanel.sh — Deploy WebMyDrive to cPanel via API token
#
# Usage:
#   CPANEL_TOKEN=your_token ./scripts/deploy-cpanel.sh
#
# Requires: curl, npm/node
# Deploys to: /home4/wmdtest/public_html/WebMyDrive/demo/1/

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
HOST="${CPANEL_HOST:-test.webmydrive.com}"
USER="${CPANEL_USER:-wmdtest}"
TOKEN="${CPANEL_TOKEN:?Set CPANEL_TOKEN env var}"
AUTH="Authorization: cpanel ${USER}:${TOKEN}"
BASE="https://${HOST}:2083/execute/Fileman/upload_files"
DEST="public_html/WebMyDrive/demo/1"

echo "=== WebMyDrive cPanel Deployment ==="
echo "Target: ${HOST} -> ${DEST}"
echo ""

# ── Step 1: Build frontend ───────────────────────────────────────────────────
echo "[1/4] Building frontend..."
npm run build -- --mode production
echo "Build complete."

# ── Step 2: Upload frontend files ────────────────────────────────────────────
echo "[2/4] Uploading frontend..."

# Upload index.html, .htaccess
curl -s -k -H "$AUTH" \
  -F "dir=${DEST}" \
  -F "file-1=@dist/index.html" \
  -F "file-2=@.htaccess" \
  -F "overwrite=1" \
  "$BASE" > /dev/null

# Upload assets
for f in dist/assets/*; do
  fname=$(basename "$f")
  curl -s -k -H "$AUTH" \
    -F "dir=${DEST}/assets" \
    -F "file-1=@${f}" \
    -F "overwrite=1" \
    "$BASE" > /dev/null
  echo "  Uploaded: assets/$fname"
done

# Upload public/ files (Logo, favicon, etc.)
for f in public/*; do
  fname=$(basename "$f")
  curl -s -k -H "$AUTH" \
    -F "dir=${DEST}" \
    -F "file-1=@${f}" \
    -F "overwrite=1" \
    "$BASE" > /dev/null
  echo "  Uploaded: $fname"
done

echo "Frontend uploaded."

# ── Step 3: Upload backend ───────────────────────────────────────────────────
echo "[3/4] Uploading backend..."

# Upload backend public/ (entry point)
curl -s -k -H "$AUTH" \
  -F "dir=${DEST}/backend/public" \
  -F "file-1=@backend/public/index.php" \
  -F "file-2=@backend/public/.htaccess" \
  -F "overwrite=1" \
  "$BASE" > /dev/null
echo "  Uploaded: backend/public/"

# Upload backend .htaccess (security)
curl -s -k -H "$AUTH" \
  -F "dir=${DEST}/backend" \
  -F "file-1=@backend/.htaccess" \
  -F "overwrite=1" \
  "$BASE" > /dev/null
echo "  Uploaded: backend/.htaccess"

# Upload backend directories
for dir in config controllers services middleware helpers; do
  for f in backend/${dir}/*.php; do
    [ -f "$f" ] || continue
    fname=$(basename "$f")
    curl -s -k -H "$AUTH" \
      -F "dir=${DEST}/backend/${dir}" \
      -F "file-1=@${f}" \
      -F "overwrite=1" \
      "$BASE" > /dev/null
    echo "  Uploaded: backend/${dir}/${fname}"
  done
done

# Upload backend .env.production as .env
if [ -f "backend/.env.production" ]; then
  cp backend/.env.production /tmp/wmd-env-upload
  curl -s -k -H "$AUTH" \
    -F "dir=${DEST}/backend" \
    -F "file-1=@/tmp/wmd-env-upload;filename=.env" \
    -F "overwrite=1" \
    "$BASE" > /dev/null
  rm /tmp/wmd-env-upload
  echo "  Uploaded: backend/.env (from .env.production)"
fi

echo "Backend uploaded."

# ── Step 4: Verify ───────────────────────────────────────────────────────────
echo "[4/4] Verifying deployment..."
HEALTH=$(curl -s -k "https://${HOST}/WebMyDrive/demo/1/backend/public/api/health" 2>/dev/null || echo "FAILED")
echo "Health check: $HEALTH"

echo ""
echo "=== Deployment complete ==="
echo "Frontend: https://${HOST}/WebMyDrive/demo/1/"
echo "Backend:  https://${HOST}/WebMyDrive/demo/1/backend/public/api/health"
