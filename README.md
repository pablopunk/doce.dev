# doce.dev - Self-Hosted AI Website Builder

<p align="center">
  <img src="https://github.com/pablopunk/doce.dev/blob/main/public/icon-128.png?raw=true" alt="doce.dev logo" width="64" />
<br />
  <img src="https://github.com/pablopunk/doce.dev/blob/main/remotion/out/doce-showcase.gif?raw=true#gh-dark-mode-only" alt="doce.dev showcase. not a real workflow, made in Remotion" width="95%" />
  <img src="https://github.com/pablopunk/doce.dev/blob/main/remotion/out/doce-showcase-light.gif?raw=true#gh-light-mode-only" alt="doce.dev showcase. not a real workflow, made in Remotion" width="95%" />
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
      - /var/run/docker.sock:/var/run/docker.sock # Required since we use containers to run projects/opencode
```

<p align="center">
  <img src="https://github.com/pablopunk/doce.dev/blob/main/public/screenshot-dark.png?raw=true#gh-dark-mode-only" alt="doce.dev screenshot" width="80%" />
  <img src="https://github.com/pablopunk/doce.dev/blob/main/public/screenshot-light.png?raw=true#gh-light-mode-only" alt="doce.dev screenshot" width="80%" />
</p>
