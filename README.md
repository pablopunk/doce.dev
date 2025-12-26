# doce.dev - Self-Hosted AI Website Builder

> Delicious Open Code Environments

<p align="center">
  <img src="https://github.com/pablopunk/doce.dev/blob/main/public/icon-128.png?raw=true" alt="doce.dev logo" width="64" />
<br />
  <img src="https://github.com/pablopunk/doce.dev/blob/main/public/screenshot-dark.png?raw=true#gh-dark-mode-only" alt="doce.dev screenshot" width="80%" />
  <img src="https://github.com/pablopunk/doce.dev/blob/main/public/screenshot-light.png?raw=true#gh-light-mode-only" alt="doce.dev screenshot" width="80%" />
</p>


> [!NOTE]
> This project is not built by the OpenCode team and is not affiliated with them in any way.

## Self-Hosted Deployment

Deploy doce.dev on your own infrastructure using Docker:

```yaml
# docker-compose.yml
services:
  doce:
    image: ghcr.io/pablopunk/doce.dev:latest
    container_name: doce-dev
    ports:
      - "80:4321"  # Change to 4321:4321 for local development
    environment:
      OPENROUTER_API_KEY: "sk-or-v1-your-openrouter-api-key-here"
    volumes:
      - doce-data:/app/data
      - /var/run/docker.sock:/var/run/docker.sock  # Required for project container management
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4321"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  doce-data:
    driver: local
```

**Environment Variables:**
- `OPENROUTER_API_KEY` - Your OpenRouter API key (get one at https://openrouter.ai)

**Volumes:**
- `doce-data` - Persists SQLite database and project files
- Docker socket - Allows spawning isolated containers for user-created projects

**To deploy:**
```bash
docker-compose up -d
```

Access the application at `http://localhost` (or your server IP).
