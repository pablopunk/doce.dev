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
ENV PATH="$PNPM_HOME:$PATH"
ENV PYTHON="python3"

RUN corepack enable

WORKDIR /app
