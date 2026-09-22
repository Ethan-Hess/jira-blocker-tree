# Chrome Web Store listing and release deploy

The extension works on any Jira Cloud site (`https://*.atlassian.net`). Host
permission is `https://*.atlassian.net/*`; the content-script drawer injects on
`/browse/*`, `/jira/*`, and `/issues/*` (not Confluence `/wiki` or the whole
host). The active tab’s origin is used for REST calls (no baked-in site, no
`JIRA_ORIGIN` in CI).

Publishing uses the [Chrome Web Store API v2](https://developer.chrome.com/docs/webstore/using-api) and [cssnr/webstore-publish-action](https://github.com/cssnr/webstore-publish-action) on GitHub **Release published** events.

## One-time: developer account and listing

1. Sign in to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Pay the one-time developer registration fee and enable **2-step verification** on the Google account that owns the listing (required to publish).
3. Create the store listing (name, description, category, privacy practices). You need at least:
   - One screenshot (1280×800 or 640×400)
   - Small promo tile (440×280)
   - A public **privacy policy** URL (session cookie use on Jira Cloud sites the user visits).
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
   - Upload and submit for publishing via the Web Store API
   - Attach the same zip to the workflow run as an artifact

You can also run the workflow manually (**Actions → Release to Chrome Web Store → Run workflow**) after secrets are set.

Each store update needs a **higher** manifest version than the last published version. Google reviews updates like the first submission.

## Visibility

Choose visibility in the dashboard (public, unlisted, or private with trusted testers). The API publishes using whatever visibility you last set in the dashboard; change it there before relying on automated publishes.

## Troubleshooting

- **Upload rejected (version):** bump `package.json` `version` and cut a new release tag.
- **403 / auth errors:** confirm the service account email is added in the developer dashboard and the JSON secret is valid.
- **No drawer on a page:** content scripts only match `/browse/*`, `/jira/*`, and `/issues/*` under `https://*.atlassian.net`.
