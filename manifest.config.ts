import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Jira Blocker Tree",
  version: "0.1.0",
  description:
    "Collapsible blocking tree for Jira epics: status, assignee, and Blocks links.",
  permissions: ["sidePanel", "storage"],
  host_permissions: ["https://your-site.atlassian.net/*"],
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  content_scripts: [
    {
      // Boards and backlogs open issues in a modal without a /browse/ URL,
      // so the script runs across the Jira surface and decides per page.
      matches: [
        "https://your-site.atlassian.net/browse/*",
        "https://your-site.atlassian.net/jira/*",
      ],
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
