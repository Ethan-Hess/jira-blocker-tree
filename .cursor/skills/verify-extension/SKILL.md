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

**Service worker does not follow Vite the way the panel does.** After edits to `src/background/`, `src/shared/buildBlockingTree.ts`, messaging types, or `BuildTreeResult` shape, run `npm run build` then `npm run reload`. A stale worker can return `ok: true` with a missing field (`issuesByKey`, `epicChildKeys`). Lineage then crashes and unmounts the drawer with no banner.

Stale-worker check: open `chrome-extension://<id>/sidepanel.html` and `chrome.runtime.sendMessage({ type: "BUILD_TREE", issueKey, force: true })` for the issue currently in the debug tab. If `data` keys omit fields the panel expects, reload the unpacked extension before debugging React.

## Inspect

```bash
npm run inspect                      # current Jira tab
npm run inspect -- --reload          # reload the page first
npm run inspect -- --open            # click Blockers, wait for the tree
npm run inspect -- --url=<issue-url>
npm run extensions                   # chrome://extensions screenshot
```

`inspect` is a tree-drawer smoke test: launcher, `.jbt-row` count, page errors, `.devtools/shot.png`. It does not switch to Lineage or click pedigree cards. Pass `--url=` only when no Jira issue tab is open. For lineage or a large graph, wait until `.jbt-meta` shows the full load (tens of issues), not the 2.5s inspect timeout.

Trust `#jbt-panel-host` `shadowRoot` (`.jbt-drawer`, `.jbt-pedigree-node`), not `data-jbt-open` on the launcher. Jira console noise (`__ is not defined`, Xray, disconnected port) is unrelated.

## Pass bar

- Launcher is in the issue header action row
- Drawer opens, tree rows render (or a clear empty/error state)
- Lineage: cards render; focusing a node highlights edges that end on cards, not mid-bus
- Side panel still works if that surface was touched
- Color mode and Jira re-render of the header still show the button
