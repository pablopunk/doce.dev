# Multi-stage build for production deployment
# Builder stage
FROM node:22-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@10.20.0

WORKDIR /app

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

RUN pnpm install --frozen-lockfile --dangerously-allow-all-builds

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Runtime stage
FROM node:22-alpine

ARG VERSION=unknown

RUN apk add --no-cache dumb-init curl docker-cli python3 make g++

ENV VERSION=${VERSION}

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate && \
    pnpm install --frozen-lockfile --prod --ignore-scripts && \
    pnpm rebuild better-sqlite3 && \
    rm -rf /root/.cache

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/templates ./templates
COPY package.json ./
COPY drizzle.config.ts ./
COPY scripts/start-preview.sh ./scripts/
COPY scripts/bootstrap.sh ./scripts/

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Make scripts executable
RUN chmod +x /app/scripts/start-preview.sh /app/scripts/bootstrap.sh

# Run as root for Docker socket access in preview environments
# (container runs as root for Docker daemon access)

# Expose port
EXPOSE 4321

# Set environment variables
ENV HOST=0.0.0.0
ENV PORT=4321

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:4321 || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the application
CMD ["node", "./dist/server/entry.mjs"]
