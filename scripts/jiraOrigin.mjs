/**
 * Jira site for the debug scripts, read from .env so the host is not in the repo.
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function jiraOrigin() {
  const envFile = resolve(ROOT, ".env");
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const origin = process.env.JIRA_ORIGIN;
  if (!origin) {
    console.error("JIRA_ORIGIN is not set. Copy .env.example to .env and set your Jira site.");
    process.exit(1);
  }
  return origin.replace(/\/+$/, "");
}

export function jiraHost() {
  return new URL(jiraOrigin()).host;
}
