import { readFileSync } from "node:fs";
import { defineManifest } from "@crxjs/vite-plugin";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

/** Jira Cloud only: content UI on issue surfaces, API under the same host. */
const JIRA_HOST = "https://*.atlassian.net/*";
const CONTENT_MATCHES = [
  "https://*.atlassian.net/browse/*",
  "https://*.atlassian.net/jira/*",
  "https://*.atlassian.net/issues/*",
];

export default defineManifest({
  manifest_version: 3,
  name: "Jira Blocker Tree",
  version,
  icons: {
    16: "public/icons/icon16.png",
    48: "public/icons/icon48.png",
    128: "public/icons/icon128.png",
  },
  description:
    "Collapsible blocking tree for Jira Cloud epics: status, assignee, and Blocks links.",
  permissions: ["sidePanel", "storage"],
  host_permissions: [JIRA_HOST],
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  content_scripts: [
    {
      // /browse/KEY classic issues; /jira/* boards + modern UI; /issues/* navigator.
      matches: CONTENT_MATCHES,
      js: ["src/content/main.tsx"],
      css: ["src/content/content.css"],
    },
  ],
  side_panel: {
    default_path: "sidepanel.html",
  },
  action: {
    default_title: "Open Jira Blocker Tree",
  },
});
