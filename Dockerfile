# Multi-stage build for production deployment
# Builder stage
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@10.20.0

WORKDIR /app

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Install dependencies and build native modules
RUN pnpm install --frozen-lockfile --dangerously-allow-all-builds

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Runtime stage
FROM node:20-alpine

# Install dumb-init for proper PID 1 handling and docker for preview environments
RUN apk add --no-cache dumb-init curl docker-cli docker-cli-compose docker-compose git

# Install pnpm for running migrations
RUN npm install -g pnpm@10.20.0

WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/templates ./templates
COPY package.json ./
COPY drizzle.config.ts ./

# Create data directory for SQLite database
RUN mkdir -p /app/data

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
