# Privacy policy

Jira Blocker Tree is a Chrome extension anyone can install. It works on Jira Cloud sites (`https://*.atlassian.net`) you visit while logged in.

## What it accesses

- Your existing Jira browser session (cookies) on the tab you have open.
- Jira REST on that same origin, with `credentials: include` and `X-Atlassian-Token: no-check`.
- Issue keys, summaries, statuses, assignees, epic children, and **Blocks** links needed to draw the tree.

It does not ask you for an API token, PAT, or OAuth login.

## Where data goes

- Requests go only to the `https://*.atlassian.net` origin of the active tab.
- A short-lived tree cache lives in `chrome.storage.session` in your browser (about 60 seconds).
- The extension does not send issue data to the developer, analytics vendors, or any other third-party server.

## Host permission

The listed host permission is `https://*.atlassian.net/*` so the same packaged build works on every Jira Cloud site. Content UI injects only on `/browse/*`, `/jira/*`, and `/issues/*`, not Confluence `/wiki` and not the whole host.

## Changes

If this policy changes, it will be updated in this file in the public repository.
