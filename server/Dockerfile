# Multi-stage Dockerfile for AI Reply Copilot backend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src/ ./src/
COPY ../shared/ ../shared/
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY src/db/migrations ./dist/db/migrations
USER appuser
EXPOSE 4000
CMD ["node", "dist/index.js"]
