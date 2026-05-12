#!/bin/sh

set -eu

APP_DIR=/app
DEPS_STATE_FILE="$APP_DIR/node_modules/.doce-deps-hash"
DEPS_TMP_STATE_FILE="$APP_DIR/node_modules/.doce-deps-hash.tmp"
DEPS_CHECK_INTERVAL_SECONDS="${DOCE_DEPS_CHECK_INTERVAL_SECONDS:-2}"
PNPM_VERSION_FALLBACK="10.20.0"
DEV_PID=""

log() {
	printf '%s %s\n' "[preview]" "$1"
}

get_pnpm_version() {
	node -p "JSON.parse(require('node:fs').readFileSync('$APP_DIR/package.json','utf8')).packageManager?.split('@')[1] || '$PNPM_VERSION_FALLBACK'"
}

ensure_pnpm() {
	PNPM_VERSION="$(get_pnpm_version)"
	corepack prepare "pnpm@$PNPM_VERSION" --activate >/dev/null 2>&1
}

compute_deps_hash() {
	(
		printf '__PREVIEW_RUNTIME__:%s\n' "node-$(node -p 'process.version')-abi-$(node -p 'process.versions.modules')-$(uname -s)-$(uname -m)"
		if command -v ldd >/dev/null 2>&1; then
			printf '__LIBC__:%s\n' "$(ldd --version 2>&1 | head -n 1)"
		fi
		for file in package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc; do
			if [ -f "$APP_DIR/$file" ]; then
				printf '__FILE__:%s\n' "$file"
				cat "$APP_DIR/$file"
				printf '\n'
			fi
		done
	) | sha256sum | awk '{print $1}'
}

read_stored_hash() {
	if [ -f "$DEPS_STATE_FILE" ]; then
		cat "$DEPS_STATE_FILE"
		return 0
	fi

	return 1
}

write_stored_hash() {
	current_hash="$1"
	printf '%s' "$current_hash" > "$DEPS_TMP_STATE_FILE"
	mv "$DEPS_TMP_STATE_FILE" "$DEPS_STATE_FILE"
}

install_dependencies() {
	log "Installing preview dependencies"
	cd "$APP_DIR"
	ensure_pnpm

	if ! CI=true pnpm install --no-frozen-lockfile --dangerously-allow-all-builds; then
		log "Preview dependency install failed"
		return 1
	fi

	write_stored_hash "$(compute_deps_hash)"
	log "Preview dependencies are ready"
}

ensure_dependencies() {
	mkdir -p "$APP_DIR/node_modules"

	current_hash="$(compute_deps_hash)"
	stored_hash=""

	if read_stored_hash >/dev/null 2>&1; then
		stored_hash="$(read_stored_hash)"
	fi

	if [ ! -d "$APP_DIR/node_modules/.pnpm" ]; then
		log "node_modules volume is empty"
		if ! install_dependencies; then
			return 1
		fi
		return 0
	fi

	if [ "$current_hash" != "$stored_hash" ]; then
		log "Dependency manifest changed"
		if ! install_dependencies; then
			return 1
		fi
		return 0
	fi

	return 10
}

start_dev_server() {
	log "Starting Astro dev server"
	cd "$APP_DIR"
	ensure_pnpm
	pnpm dev --host &
	DEV_PID=$!
}

stop_dev_server() {
	if [ -z "$DEV_PID" ]; then
		return 0
	fi

	if kill -0 "$DEV_PID" 2>/dev/null; then
		log "Stopping Astro dev server"
		kill "$DEV_PID" 2>/dev/null || true
		wait "$DEV_PID" 2>/dev/null || true
	fi

	DEV_PID=""
}

restart_dev_server() {
	stop_dev_server
	start_dev_server
}

cleanup() {
	stop_dev_server
}

trap cleanup EXIT INT TERM

log "Booting preview environment"
if ensure_dependencies; then
	:
else
	deps_status=$?
	if [ "$deps_status" -eq 10 ]; then
		log "Preview dependencies are already up to date"
	else
		exit "$deps_status"
	fi
fi
start_dev_server

while :; do
	sleep "$DEPS_CHECK_INTERVAL_SECONDS"

	if ensure_dependencies; then
		log "Restarting Astro dev server after dependency sync"
		restart_dev_server
	else
		deps_status=$?
		if [ "$deps_status" -ne 10 ]; then
			exit "$deps_status"
		fi
	fi

	if ! kill -0 "$DEV_PID" 2>/dev/null; then
		wait "$DEV_PID"
		exit $?
	fi
done
