#!/bin/sh
# Keep yt-dlp (and the bgutil PO-token plugin) current on every start. YouTube
# breaks older yt-dlp builds every few weeks, so a build-time pin goes stale fast.
# Best-effort: if the update fails (e.g. no network), we keep the pinned version.
# Disable with YTDLP_AUTO_UPDATE=false.
set -e

if [ "${YTDLP_AUTO_UPDATE:-true}" = "true" ]; then
  echo "[entrypoint] Updating yt-dlp + bgutil plugin…"
  /opt/ytdlp/bin/pip install -U --quiet --disable-pip-version-check \
    yt-dlp bgutil-ytdlp-pot-provider || echo "[entrypoint] update skipped (offline?)"
  echo "[entrypoint] yt-dlp $(/opt/ytdlp/bin/yt-dlp --version 2>/dev/null || echo '?')"
fi

exec node server.js
