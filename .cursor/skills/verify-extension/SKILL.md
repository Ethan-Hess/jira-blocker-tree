---
name: verify-extension
description: Verifies Jira Blocker Tree UI in the shared debug Chrome (CDP port 9222) using npm run inspect and npm run chrome. Use after content-script, drawer, side panel, or CSS changes, or when the user asks to test, inspect, reload, or screenshot the extension.
---

# Verify the extension in debug Chrome

## Bring-up

If debug Chrome is not already running:

1. `npm run dev` (Vite; keep running)
2. `npm run chrome` (profile under `.devtools/chrome-profile`, CDP `127.0.0.1:9222`)

The user must be logged into `https://your-site.atlassian.net` in that window. Do not use `--disable-extensions-except`.

If the extension is missing after a Chrome restart, run `npm run chrome` again (CDP load does not persist). After a manual `npm run build`, `npm run reload` reinstalls `dist/`.

## Inspect

```bash
npm run inspect                      # current Jira tab
npm run inspect -- --reload          # reload the page first
npm run inspect -- --open            # click Blockers, wait for the tree
npm run inspect -- --url=https://your-site.atlassian.net
npm run extensions                   # chrome://extensions screenshot
```

`inspect` reports launcher/drawer mount, row count, page errors, console output, and writes `.devtools/shot.png`.

## Pass bar

- Launcher is in the issue header action row
- Drawer opens, tree rows render (or a clear empty/error state)
- Side panel still works if that surface was touched
- Color mode and Jira re-render of the header still show the button
