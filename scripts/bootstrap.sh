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

DB_FILE="${DB_FILE_NAME:-data/db.sqlite}"
if [ -f "$DB_FILE" ]; then
	echo "Checking database schema..."
	if ! sqlite3 "$DB_FILE" "PRAGMA table_info(user_settings);" | grep -q "fast_model"; then
		echo "Adding missing fast_model column to user_settings..."
		sqlite3 "$DB_FILE" "ALTER TABLE user_settings ADD COLUMN fast_model TEXT;"
		echo "Column added successfully."
	fi
fi

echo "Bootstrap completed successfully!"
