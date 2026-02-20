#!/bin/sh

set -e

mkdir -p data

# Install dependencies
pnpm install

# If no migrations exist, generate them from schema first
if [ ! -f "drizzle/meta/_journal.json" ]; then
	echo "No migrations found, generating from schema..."
	pnpm drizzle-kit generate
fi

# Run migrations
echo "Running database migrations..."
pnpm drizzle-kit migrate

echo "Bootstrap completed successfully!"
