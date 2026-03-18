# doce.dev - Self-Hosted AI Website Builder

<p align="center">
  <img src="https://github.com/pablopunk/doce.dev/blob/main/public/icon-128.png?raw=true" alt="doce.dev logo" width="64" />
<br />
  <img src="https://github.com/pablopunk/doce.dev/blob/main/www/remotion/out/doce-showcase.gif?raw=true#gh-dark-mode-only" alt="doce.dev showcase. not a real workflow, made in Remotion" width="95%" />
  <img src="https://github.com/pablopunk/doce.dev/blob/main/www/remotion/out/doce-showcase-light.gif?raw=true#gh-light-mode-only" alt="doce.dev showcase. not a real workflow, made in Remotion" width="95%" />
</p>

Doce stands for:

- **D**elicious **O**pen **C**ode **E**nvironments
- **D**eploy **O**n **C**ontainers **E**asily
- **D**eploy **O**rchestrated **C**ontainers
- **D**eploy **O**nce **C**rash **E**verywhere
- **D**on't **O**ver **C**omplicate **E**nvironments
- ...

<p align="center">
</p>

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
      - /var/run/docker.sock:/var/run/docker.sock # Required since we use containers to run project previews
```

That's still the whole deployment story. Internally, `doce` now runs:

- the Astro app
- one central `opencode` server
- the queue worker

Project previews still run in isolated Docker Compose stacks, but OpenCode itself is now global and shared.

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

<p align="center">
  <img src="https://github.com/pablopunk/doce.dev/blob/main/public/screenshot-dark.png?raw=true#gh-dark-mode-only" alt="doce.dev screenshot" width="80%" />
  <img src="https://github.com/pablopunk/doce.dev/blob/main/public/screenshot-light.png?raw=true#gh-light-mode-only" alt="doce.dev screenshot" width="80%" />
</p>

## License

Copyright (C) 2025 Pablo P Varela

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

See [LICENSE](./LICENSE) for the full text.
