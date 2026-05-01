# doce.dev - Self-Hosted AI Website Builder

<p align="center">
  <img src="https://github.com/pablopunk/doce.dev/blob/main/public/icon-128.png?raw=true" alt="doce.dev logo" width="64" />
  <br />
  <img src="https://github.com/pablopunk/doce.dev/blob/main/public/screenshots/homepage.jpg?raw=true" alt="Homepage" width="95%" />
  <img src="https://github.com/pablopunk/doce.dev/blob/main/public/screenshots/project-view.jpg?raw=true" alt="Project view with preview, chat, and terminal logs" width="95%" />
</p>

</p>

Doce stands for:

- **D**elicious **O**pen **C**ode **E**nvironments
- **D**eploy **O**n **C**ontainers **E**asily
- **D**eploy **O**rchestrated **C**ontain**E**rs
- **D**eploy **O**nce **C**rash **E**verywhere
- **D**on't **O**ver **C**omplicate **E**nvironments
- ...

<p align="center">
</p>

## Features

- 🤖 Self-hosted AI website builder powered by OpenCode
- 🧰 Live project workspace: chat, preview, files, assets, and terminal logs
- 🐳 Isolated Docker previews with one-click production deployments
- 🔐 Provider auth, model selection, skills, and MCPs managed from the UI
- 🌐 Automatic private HTTPS domains via Tailscale (`https://...ts.net`)

## docker-compose.yml

Deploy doce.dev on your own infrastructure using Docker Compose:

```yaml
# docker-compose.yml
services:
  doce:
    image: ghcr.io/pablopunk/doce.dev:latest
    container_name: doce
    restart: unless-stopped
    ports:
      - "4321:4321"
    volumes:
      - ./data:/app/data # DB and project files
      - ./opencode:/root/.local/share/opencode # opencode auth data
      - /var/run/docker.sock:/var/run/docker.sock # Required to run projects
```

That's still the whole deployment story. Internally, `doce` now runs:

- the Astro app
- one central `opencode` server
- the queue worker

Project previews still run in isolated Docker Compose stacks, but OpenCode itself is now global and shared.

## Automatic HTTPS with Tailscale

Connect Tailscale once in settings and doce gives the app, previews, and deployments stable private `https://...ts.net` URLs. No DNS, reverse proxy, or TLS setup required.

## Screenshots

### One button to automatically fix issues on your apps

<p align="center">
  <img src="https://github.com/pablopunk/doce.dev/blob/main/public/screenshots/fix-with-doce.jpg?raw=true" alt="Fixing a website with doce.dev" width="95%" />
</p>

### Dark/Light mode, detached transparent chat, and server logs

<p align="center">
  <img src="https://github.com/pablopunk/doce.dev/blob/main/public/screenshots/transparent-chat-light.jpg?raw=true" alt="Transparent chat in light mode" width="95%" />
</p>

### File browser

<p align="center">
  <img src="https://github.com/pablopunk/doce.dev/blob/main/public/screenshots/file-browser.jpg?raw=true" alt="Project file browser" width="95%" />
</p>

### Skills and MCPs

<p align="center">
  <img src="https://github.com/pablopunk/doce.dev/blob/main/public/screenshots/skills.jpg?raw=true" alt="OpenCode skills settings" width="95%" />
</p>

### Automatic tailscale config

<p align="center">
  <img src="https://github.com/pablopunk/doce.dev/blob/main/public/screenshots/tailscale.jpg?raw=true" alt="Tailscale settings" width="95%" />
</p>

## How it works

- Provider auth lives in the central OpenCode runtime, not per project
- Project files live under `data/projects/<project-id>/preview`
- Preview containers bind-mount those project folders directly
- The UI proxies project-scoped requests to the single OpenCode server
- API-key and subscription-style auth methods are surfaced from upstream OpenCode

## Notes

- `./data` contains the SQLite database, OpenCode state, and all project files
- If you delete `./data`, doce.dev starts from scratch with a clean database and no projects/providers
- The bundled OpenCode runtime currently uses a permissive permission config intended for trusted self-hosted usage

## License

Copyright (C) 2025 Pablo P Varela

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

See [LICENSE](./LICENSE) for the full text.
