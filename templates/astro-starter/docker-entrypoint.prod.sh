#!/bin/sh
set -e

PORT=${PRODUCTION_PORT:-5000}

# Build and run preview
pnpm run build && pnpm run preview --port "$PORT" --host
