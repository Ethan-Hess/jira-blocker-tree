import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const origin = env.JIRA_ORIGIN?.replace(/\/+$/, "");
  if (!origin) {
    throw new Error("JIRA_ORIGIN is not set. Copy .env.example to .env and set your Jira site.");
  }

  return {
    define: { __JIRA_ORIGIN__: JSON.stringify(origin) },
    plugins: [react(), crx({ manifest })],
  };
});
