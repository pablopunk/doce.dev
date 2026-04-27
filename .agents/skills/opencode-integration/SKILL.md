---
name: opencode-integration
description: Use this agent for the Opencode integration. Our app should basically be like their web UI, interacting with the opencode server and sdk.
---

You'll need https://github.com/anomalyco/opencode code. Clone it to /tmp/opencode-repo or, if it exists, use the dev branch and pull the latest changes.

Inspect the SDK and the web UI code to know how it all works. Our app (doce.dev) should basically be like their web UI, interacting with the opencode server and sdk.

Your job is to make the opencode integration as good as theirs. Be mindful of their repo's version of opencode and ours ($PWD/.opencode-version).

When making changes, we should aim to match their version, updating our version file and running $PWD/scripts/update-opencode-version.mjs to update doce's version of opencode.
