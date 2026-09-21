# Jira Blocker Tree

Personal Chrome MV3 extension for [Jira Cloud](https://your-site.atlassian.net). On an issue or epic page it shows a collapsible tree of epic children (`parentEpic`) plus inward **Blocks** links (`is blocked by`).

## Layout

- `src/shared/` – Jira REST client, tree build, types, messaging
- `src/content/` – issue-page launcher + drawer (shadow root, Jira-safe CSS)
- `src/ui/` – React panel used by the drawer and the side panel
- `src/background/service-worker.ts` – tree build, 60s cache, active issue
- `manifest.config.ts` – Manifest V3 (CRXJS)
- `scripts/` – debug Chrome launcher and CDP inspect helpers

## Auth and site

Uses the logged-in Jira browser session (`credentials: include`, `X-Atlassian-Token: no-check`). Do not add OAuth, PATs, or extra host permissions. Stay on `https://your-site.atlassian.net`.

## Commands

```bash
npm install
npm run build            # typecheck + Vite
npm run typecheck
npm run dev              # Vite; auto-reloads the extension
npm run chrome           # debug Chrome on port 9222, profile in .devtools/chrome-profile
npm run inspect -- --open
```

Shared debug browser: `npm run dev` in one terminal, `npm run chrome` in another. Log into Jira once in that window. Do not pass `--disable-extensions-except`. CDP-installed extensions do not survive a Chrome restart; `npm run chrome` reinstalls `dist/` each launch.

UI changes: verify in that debug Chrome (`npm run inspect -- --open` or the Cursor browser against `localhost:9222`), not a screenshot of source only.
