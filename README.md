# doce.dev - Self-Hosted AI Website Builder

## To Do

- [x] template: different docker-compose for dev and prod (commands and ports should differ)
- [ ] Add agent-controlled "Tasks" section to chat interface
- [ ] Agent tool: cli commands
- [ ] Agent tool: web requests
- [ ] Deployments. `astro build` + `astro preview`
- [ ] Set up reverse proxy for deployment routing (traefik?)
- [ ] Add file tree view for project navigation
- [ ] Allow to edit files in the files view
- [ ] Project state restoration from any chat message
- [ ] Multi-user support with authentication and authorization
- [ ] Git integration for version control and rollback
- [ ] Project export/import functionality
- [ ] Support for multiple frameworks (Next.js, etc.) and infra
- [ ] Add agent-controlled "Tasks" section to chat interface
- [x] Make design system have semantic colors. There should be zero "dark:" classes in the codebase, since there's no reason to differentiate between light and dark mode with semantic colors.
- [ ] URL bar in the preview window
- [x] Remove all semantic colors from shadcn/ui and add the ones from our design system
- [x] Add guidelines for persistance in templates/. Simple peristance can go to local storage, but for more complex stuff, it should use sqlite.
- [ ] Get rid of console erros in dashboard
