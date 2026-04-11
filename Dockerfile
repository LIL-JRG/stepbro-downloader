# ── Stage 1: Dependencies ─────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Stage 3: Runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# System deps: ffmpeg for merging, python3 for yt-dlp + plugins
RUN apk add --no-cache ffmpeg python3 ca-certificates

# Install yt-dlp and the bgutil PO token provider in a virtualenv.
# Using a venv guarantees both packages share the same Python environment
# so yt-dlp's plugin discovery finds bgutil automatically.
RUN python3 -m venv /opt/ytdlp && \
    /opt/ytdlp/bin/pip install yt-dlp bgutil-ytdlp-pot-provider

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    YT_DLP_BIN=/opt/ytdlp/bin/yt-dlp

# Copy standalone Next.js output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
