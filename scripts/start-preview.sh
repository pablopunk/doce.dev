#!/bin/bash

# Startup script for preview environments
# Handles migrations with automatic DB reset on failure

set -e

echo "🚀 Starting doce.dev preview environment..."

# Function to run bootstrap with fallback to DB wipe on preview environments
run_bootstrap() {
	local is_preview="${PREVIEW_ENV:-false}"
	
	# Try to run bootstrap normally
	echo "📦 Running bootstrap..."
	if pnpm bootstrap 2>/dev/null; then
		echo "✅ Bootstrap completed successfully!"
		return 0
	fi
	
	# If bootstrap failed and we're in a preview environment, wipe the DB and retry
	if [ "$is_preview" = "true" ]; then
		echo "⚠️  Bootstrap failed in preview environment"
		echo "🧹 Wiping database and retrying..."
		
		# Remove database files
		rm -f /app/data/db.sqlite
		rm -f /app/data/db.sqlite-shm
		rm -f /app/data/db.sqlite-wal
		
		# Retry bootstrap
		if pnpm bootstrap; then
			echo "✅ Bootstrap completed after DB wipe!"
			return 0
		fi
	fi
	
	echo "❌ Bootstrap failed"
	return 1
}

# Run bootstrap (with DB wipe fallback on preview)
run_bootstrap

# Start the application
echo "🎯 Starting application..."
exec node ./dist/server/entry.mjs
