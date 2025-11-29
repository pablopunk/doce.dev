FROM node:lts-slim

# Install git + Python + build tools for native modules
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    git \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME="/pnpm"
ENV PATH="$HOME/.local/bin:$PNPM_HOME:$PATH"
ENV PYTHON="python3"

RUN "XDG_BIN_DIR=$HOME/.local/bin VERSION=latest curl -fsSL https://opencode.ai/install | bash"

RUN cat <<'EOF' > /usr/local/bin/opencode-entrypoint.sh \
 && chmod +x /usr/local/bin/opencode-entrypoint.sh
#!/bin/bash
set -euo pipefail

: "${OPENCODE_HOST:=0.0.0.0}"
: "${OPENCODE_PORT:=4096}"
: "${OPENCODE_DATA_DIR:=/app/.opencode}"
: "${OPENCODE_LOG_PATH:=/var/log/opencode.log}"

mkdir -p "$OPENCODE_DATA_DIR" "$(dirname "$OPENCODE_LOG_PATH")"

echo "[opencode] starting server on ${OPENCODE_HOST}:${OPENCODE_PORT}"
if command -v opencode >/dev/null 2>&1; then
	opencode serve \
		--hostname "$OPENCODE_HOST" \
		--port "$OPENCODE_PORT" \
		--data "$OPENCODE_DATA_DIR" \
		--rules "$OPENCODE_DATA_DIR/rules" \
		--workspace /app \
		>> "$OPENCODE_LOG_PATH" 2>&1 &
fi

exec "$@"
EOF

RUN corepack enable

WORKDIR /app

ENTRYPOINT ["/usr/local/bin/opencode-entrypoint.sh"]
