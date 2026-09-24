# Chrome Web Store listing and release deploy

This is a **public** extension for anyone on Jira Cloud (`https://*.atlassian.net`),
not a private or single-tenant build. Host permission is `https://*.atlassian.net/*`;
the content-script drawer injects on `/browse/*`, `/jira/*`, and `/issues/*` (not
Confluence `/wiki` or the whole host). The active tab’s origin is used for REST
calls (no baked-in site, no `JIRA_ORIGIN` in CI).

Publishing uses the [Chrome Web Store API v2](https://developer.chrome.com/docs/webstore/using-api) and [cssnr/webstore-publish-action](https://github.com/cssnr/webstore-publish-action) on GitHub **Release published** events.

## Listing copy (public)

**Name:** Jira Blocker Tree

**Short description:** Collapsible blocking tree for Jira Cloud: epic children, Blocks links, status, and lineage.

**Single purpose:** Show a collapsible tree of epic children and inward Blocks links on Jira Cloud issue pages.

Suggested description:

```
For anyone on Jira Cloud. Open an issue or epic, click Blockers, and see what is blocked and what is blocking.

Works on every https://*.atlassian.net site you are already logged into. No API token. The site comes from the tab you have open.

Tree view: epic children plus “is blocked by” links, with status, assignee, and leverage.
Lineage view: the same graph by layer (what can move in parallel vs what is waiting).
Hide done, search, and refresh from the drawer or the side panel.
```

## Screenshots and privacy URL

Store-sized shots (1280×800, issue text redacted) live in `store-assets/`:

| File | Use |
| --- | --- |
| `01-tree.png` | Primary screenshot (tree drawer) |
| `03-lineage.png` | Lineage view |
| `02-tree-hide-done.png`, `04-lineage-left-right.png` | Extra listing shots |

Recapture from the debug Chrome (`npm run chrome`, logged into any Cloud site):

```bash
node scripts/store-shots.mjs --key=PROJ-123
```

Privacy policy for the listing: [PRIVACY.md](PRIVACY.md) (use the GitHub URL of that file on `main`).

## One-time: developer account and listing

1. Sign in to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Pay the one-time developer registration fee and enable **2-step verification** on the Google account that owns the listing (required to publish).
3. Create a **public** store listing (name, description, category, privacy practices). You need at least:
   - Screenshots (1280×800 or 640×400); start with `store-assets/01-tree.png` and `03-lineage.png`
   - Small promo tile (440×280)
   - A public **privacy policy** URL pointing at [PRIVACY.md](PRIVACY.md)
4. **First upload (manual):**
   ```bash
   npm run build
   npm run zip
   ```
   Upload `jira-blocker-tree.zip` as **New item**. Complete **Store listing** and **Privacy**, then submit for review once.
5. After the item exists, copy:
   - **Extension ID** (32-character id on the item page)
   - **Publisher ID** (Developer Dashboard → Account / Publisher settings)

Replace placeholder icons if you want: `npm run icons` writes `public/icons/icon{16,48,128}.png`.

## One-time: service account for GitHub Actions

1. In [Google Cloud Console](https://console.cloud.google.com/), enable **Chrome Web Store API** on a project.
2. Create a **service account** (no extra IAM roles required for the basic flow).
3. Create a JSON key for that service account. Keep it secret.
4. In the Chrome Web Store Developer Dashboard, under **Account**, add the service account email (only one service account per publisher at this time). See [Use a service account](https://developer.chrome.com/docs/webstore/service-accounts).

## GitHub repository secrets

In `https://github.com/Ethan-Hess/jira-blocker-tree/settings/secrets/actions`, add:

| Secret | Value |
| --- | --- |
| `CHROME_EXTENSION_ID` | From the dashboard after first upload |
| `CHROME_PUBLISHER_ID` | Publisher ID from account settings |
| `CHROME_WEBSTORE_SERVICE_ACCOUNT_JSON` | Full JSON key file contents for the service account |

## Release workflow

1. Bump **`version`** in `package.json` (manifest version follows it).
2. Commit and push to `main`.
3. Create a GitHub release with tag **`vX.Y.Z`** matching `package.json` (e.g. version `0.1.1` → tag `v0.1.1`).
4. Publish the release. The [Release to Chrome Web Store](.github/workflows/release.yml) workflow will:
   - Build the extension (no site-specific env)
   - Zip `dist/`
   - Attach `jira-blocker-tree.zip` to the GitHub release (for Load unpacked)
   - Upload and submit to the Chrome Web Store **only if** the Web Store secrets are set
   - Also attach the zip to the workflow run as an artifact

You can also run the workflow manually (**Actions → Release to Chrome Web Store → Run workflow**). Manual runs still produce a workflow artifact; they do not attach a file to a GitHub release.

Each store update needs a **higher** manifest version than the last published version. Google reviews updates like the first submission.

**Load unpacked from the zip:** download `jira-blocker-tree.zip` from the release, unzip it, then Chrome → Extensions → Developer mode → **Load unpacked** → select the folder that contains `manifest.json`.

## Visibility

Set the listing to **Public** so anyone with Chrome can install it. The API publishes using whatever visibility you last set in the dashboard; change it there before relying on automated publishes. Unlisted or trusted-tester is only for a dry run before the first public submit.

## Troubleshooting

- **Upload rejected (version):** bump `package.json` `version` and cut a new release tag.
- **403 / auth errors:** confirm the service account email is added in the developer dashboard and the JSON secret is valid.
- **No drawer on a page:** content scripts only match `/browse/*`, `/jira/*`, and `/issues/*` under `https://*.atlassian.net`.
