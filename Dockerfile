# ── Multi-Stage Dockerfile for Coolify / Docker Production Deployment ──

FROM oven/bun:1-debian AS base
WORKDIR /app

# Install system utilities & SSL certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Stage 1: Build & Dependencies
FROM base AS builder
WORKDIR /app

# Copy dependency definitions
COPY package.json bun.lock* ./

# Install all dependencies (including build tools for Vite/Vue)
RUN bun install || npm install

# Copy application source code
COPY . .

# Build frontend production assets into public/
RUN bun run build:ui || npm run build:ui

# Stage 2: Production Runtime
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV APP_ENV=production
ENV APP_PORT=3000
ENV PORT=3000
ENV UI=true

# Copy built application and modules from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh

# Ensure execute permissions on entrypoint
RUN chmod +x /app/docker-entrypoint.sh

# Expose default HTTP port
EXPOSE 3000

# Run entrypoint script
ENTRYPOINT ["/app/docker-entrypoint.sh"]
