FROM --platform=linux/amd64 node:lts-slim

# Install git + Python + build tools for native modules
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    git \
    python3 \
    make \
    g++ \
    curl \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install OpenCode CLI
RUN curl -fsSL https://opencode.ai/install | XDG_BIN_DIR=/usr/local/bin bash

ENV PNPM_HOME="/pnpm"
ENV PATH="$HOME/.local/bin:$PNPM_HOME:/root/.opencode/bin:$PATH"
ENV PYTHON="python3"

RUN corepack enable

WORKDIR /app

CMD ["pnpm", "run", "dev"]
