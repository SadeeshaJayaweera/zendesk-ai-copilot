# Multi-stage production-hardened Dockerfile for AI Support Engineering Platform
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first for maximum layer cache reuse
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy server and shared contracts
COPY src/ ./src/
COPY ../shared/ /shared/
RUN npm run build

# Production Runner Stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Run as non-root user (Principle of Least Privilege)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY src/db/migrations ./dist/db/migrations

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 4000

# Built-in container health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/index.js"]
