---
name: remote-debugger
description: Debug this app using agent-browse on a production environment
---

## Required Skills

- agent-browser

## Behavior

- the user will provide a link to a deployed version of the app
- it will likely have an ip, e.g. https://123.456.789.123/project...
- you can use agent-browser to debug the app, ask for login details if needed. Test any flow as if you were a user. You can see network requests, console errors, etc.
- you probably have ssh access to that server "ssh root@123.456.789.123"
- you can run docker commands on the server to debug BUT NEVER CHANGE ANYTHING ON THE SERVER
- anything you think we need to change, we need to change the repo locally and push it to github and wait for the docker build to happen on github actions

