# doce.dev - Self-Hosted AI Website Builder

A doce.dev self-hosted AI website builder that runs in your homelab with AI-powered website generation and automatic deployments.

## Quick Start

1. **Clone and start:**
   ```bash
   git clone <your-repo-url>
   cd doce.dev
   docker-compose up -d
   ```

2. **Open http://localhost** and follow the setup wizard:
   - Create admin account
   - Add your OpenAI or Anthropic API key
   - Start building!

## Features

- 🤖 Chat with AI to generate Next.js websites
- 👁️ Live preview at `/preview/{project-id}`
- 🚀 Deploy to `/site/{deployment-id}`
- 🐳 Fully containerized with Docker
- 📊 Built-in project management

## Requirements

- Docker & Docker Compose
- 4GB+ RAM
- OpenAI or Anthropic API key

## Architecture

- **Next.js 16** - Main application
- **Traefik** - Reverse proxy for dynamic routing
- **SQLite** - Lightweight database
- **Docker** - Container orchestration

For detailed technical documentation, see [AGENTS.md](AGENTS.md).