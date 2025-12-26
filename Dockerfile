# Multi-stage build for production deployment
# Builder stage
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@10.20.0

WORKDIR /app

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Runtime stage
FROM node:20-alpine

# Install dumb-init for proper PID 1 handling
RUN apk add --no-cache dumb-init=1.2.5-r2 curl=8.12.1-r0

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S node -u 1001

WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=node:nodejs /app/dist ./dist
COPY --from=builder --chown=node:nodejs /app/node_modules ./node_modules
COPY --chown=node:nodejs package.json ./

# Switch to non-root user
USER node

# Expose port
EXPOSE 4321

# Set environment variables
ENV HOST=0.0.0.0
ENV PORT=4321

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:4321 || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["/sbin/dumb-init", "--"]

# Start the application
CMD ["node", "./dist/server/entry.mjs"]
