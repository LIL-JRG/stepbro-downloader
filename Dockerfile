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

# System deps: ffmpeg for merging, python3 + pip for yt-dlp and plugins
RUN apk add --no-cache ffmpeg python3 py3-pip ca-certificates

# Install yt-dlp via pip so plugins (bgutil) are discovered automatically,
# and install the bgutil PO token provider to bypass YouTube bot detection
RUN pip3 install --break-system-packages yt-dlp bgutil-ytdlp-pot-provider

# Symlink node as nodejs so yt-dlp can find it with --js-runtimes nodejs
RUN ln -sf /usr/local/bin/node /usr/local/bin/nodejs

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Copy standalone Next.js output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
