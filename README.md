# Jira Blocker Tree (Chrome extension)

Personal Chrome extension for [Jira Cloud](https://your-site.atlassian.net). On an issue or epic page, it builds a collapsible tree of:

- Issues linked to the epic (`parentEpic = KEY`)
- Inward **Blocks** links (`is blocked by`), including cross-project blockers

Each row shows issue key, summary, status, assignee, and a badge when the issue blocks others.

## Requirements

- Node.js 20+
- Chrome (Manifest V3, side panel support recommended)
- Logged-in session on `your-site.atlassian.net` in the same browser profile

## Setup

```bash
cd jira-blocker-tree
npm install
npm run build
```

Load unpacked in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** and select the `dist` folder (after `npm run build`)

## Usage

1. Open any Jira issue URL, for example `https://your-site.atlassian.net`
2. Click **Blockers** in the issue header action row (next to Automation and Open in coding tool) to open the drawer
3. Or click the extension icon to open the **side panel** (tracks the active Jira tab when possible)
4. Use **Refresh** after changing links, **Hide done** to filter completed work

The walker uses LVT link type **Blocks** (inward: `is blocked by`, outward: `is blocking`). Depth and node caps prevent runaway graphs.

## Performance

Issues are loaded breadth-first, one batched request per level:

- Root issue and `parentEpic` children load in parallel
- Each deeper level resolves through `key in (...)` searches, 50 keys per request, batches in parallel
- The service worker caches a built tree for 60 seconds and de-duplicates concurrent builds, so reopening the drawer is instant

**Refresh** always bypasses the cache.

## Development

```bash
npm run dev   # watch build
```

After changes, click **Reload** on the extension card in `chrome://extensions`.

Shared logic lives under `src/shared/`:

- `jira/client.ts` – session REST calls (`credentials: include`, `X-Atlassian-Token: no-check`) and batched key lookups
- `buildBlockingTree.ts` – level-by-level prefetch and tree assembly

UI lives under `src/ui/`. The content script renders the drawer inside a shadow root so Jira's global CSS cannot affect it, and injects the header button via `src/content/mountPoints.ts`, which re-attaches the button whenever Jira re-renders the issue header.

## Future: Forge issue panel

To ship this inside Jira for the team, reuse the same modules in a Forge app:

1. Copy `src/shared/` (or publish as an internal package)
2. Replace `jira/client.ts` fetch with Forge `requestJira` (`asUser()`)
3. Mount the same React tree in a `jira:issuePanel` UI Kit or Custom UI resource
4. Pass the issue key from Forge context instead of the browse URL

No OAuth or PAT is required for the Chrome extension because it uses your existing Jira browser session.
