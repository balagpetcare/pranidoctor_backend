# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build

RUN npm prune --production

# ============================================
# Stage 3: Runner
# ============================================
FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/prisma ./prisma
COPY --from=builder --chown=appuser:nodejs /app/package.json ./
# Legacy compat routes load .ts at runtime (R-001 mitigation)
COPY --from=builder --chown=appuser:nodejs /app/src/legacy ./src/legacy
COPY --from=builder --chown=appuser:nodejs /app/openapi.json ./openapi.json

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# tsx is required to execute legacy route handlers in production container
CMD ["node", "--import", "tsx", "dist/server.js"]
