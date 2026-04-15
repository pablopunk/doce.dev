# Multi-stage build for production deployment
# Builder stage
FROM node:22-slim AS builder

# Install pnpm
RUN npm install -g pnpm@10.20.0

WORKDIR /app

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

RUN pnpm install --frozen-lockfile --dangerously-allow-all-builds

# Cache bust: VERSION changes with every commit (date-SHA)
# This must be placed BEFORE "COPY . ." to ensure cache invalidation
ARG VERSION=unknown

# Copy source code
COPY . .

# Set VERSION env for build
ENV VERSION=${VERSION}

# Build the application
RUN pnpm build

# Runtime stage
FROM node:22-slim

ARG VERSION=unknown

RUN apt-get update && apt-get install -y dumb-init curl ca-certificates docker.io && rm -rf /var/lib/apt/lists/*

# Install Docker Compose v2 plugin (v1 docker-compose uses wrong container naming)
RUN mkdir -p /usr/lib/docker/cli-plugins \
    && ARCH=$(uname -m) \
    && curl -fsSL "https://github.com/docker/compose/releases/download/v2.36.1/docker-compose-linux-${ARCH}" \
       -o /usr/lib/docker/cli-plugins/docker-compose \
    && chmod +x /usr/lib/docker/cli-plugins/docker-compose

ENV VERSION=${VERSION}

RUN npm install -g pnpm@10.20.0

# Install OpenCode CLI for the central runtime
RUN curl -fsSL https://opencode.ai/install | bash -s -- --version 1.4.6

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
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
ENV PATH=/root/.opencode/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:4321 || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["sh", "-c", "pnpm bootstrap && node ./dist/server/entry.mjs"]
