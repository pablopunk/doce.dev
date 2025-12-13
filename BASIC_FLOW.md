Make this workflow work and test it yourself with chrome-devtools until you get it perfect:

* User can create a new project with a propmt
* It gets redirected to the project page ONLY when the docker container for the new project is ready so opencode server can start taking messages
* The project shows a Chat UI in the middle with the initial propmt as the first message. The preview is hidden for now.
* Everything that opencode does gets shown in the chat UI, tool calls, thoughts, everything
* The user cannot send messages while opencode is processing a request
* The preview ONLY shows the page when the first prompt has finished and the docker container starts the dev server (pnpm dev)
* The app is built and the preview shows the page
* The user can send another message to change something small on the page
* Opencode starts processing again and the page gets updated automatically because of the dev server running
* User can go back to the dashboard and the new project is listed there

