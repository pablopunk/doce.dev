# doce.dev - Self-Hosted AI Website Builder

> Delicious Open Code Environments

## To Do

- [ ] Add file tree view for project navigation
- [ ] Allow to edit files in the files view
- [ ] Project state restoration from any chat message
- [ ] Multi-user support with authentication and authorization
- [ ] Git integration for version control and rollback
- [ ] Project export/import functionality
- [ ] URL bar in the preview window
- [ ] Add a way to insert assets into the project, e.g. images, videos, etc.
- [ ] Multiple design systems: I think having several tailwind configs / css files would be enough here. Default to one, let user choose.
- [ ] Fork project (fresh context)
- [ ] Add chrome-devtools mcp to each project and a headless chrome (docker-compose) so they can inspect their own preview
- [ ] Remote projects.
  - [ ] Connect to a remove opencode server
  - [ ] Preview and settings can be obtained from opencode (?)
- [ ] One-click integrations. Databases, APIs, etc, can be additions to the docker-compose of one project. AI should be able to add them to the project.
- [ ] Task queue system. There's a few tasks that should be async and state-machine driven. Example: Project removal
