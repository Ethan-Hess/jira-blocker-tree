import { defineManifest } from "@crxjs/vite-plugin";
import { loadEnv } from "vite";

export default defineManifest(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const origin = env.JIRA_ORIGIN?.replace(/\/+$/, "");
  if (!origin) {
    throw new Error("JIRA_ORIGIN is not set. Copy .env.example to .env and set your Jira site.");
  }

  return {
    manifest_version: 3,
    name: "Jira Blocker Tree",
    version: "0.1.0",
    description:
      "Collapsible blocking tree for Jira epics: status, assignee, and Blocks links.",
    permissions: ["sidePanel", "storage"],
    host_permissions: [`${origin}/*`],
    background: {
      service_worker: "src/background/service-worker.ts",
      type: "module",
    },
    content_scripts: [
      {
        // Boards and backlogs open issues in a modal without a /browse/ URL,
        // so the script runs across the Jira surface and decides per page.
        matches: [`${origin}/browse/*`, `${origin}/jira/*`],
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
  };
});
