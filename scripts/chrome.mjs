#!/usr/bin/env node
/**
 * Launch a dedicated Chrome instance with remote debugging enabled.
 *
 * A separate user-data-dir is required: Chrome refuses to enable the debugging
 * port on a profile that is already open in another instance. The profile
 * persists, so the Jira login only has to happen once.
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROFILE_DIR = resolve(ROOT, ".devtools/chrome-profile");
const EXTENSION_DIR = resolve(ROOT, "dist");
const PORT = process.env.CDP_PORT ?? "9222";
const START_URL =
  process.argv[2] ?? "https://your-site.atlassian.net";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

mkdirSync(PROFILE_DIR, { recursive: true });

// Chrome 137 removed --load-extension, so the extension is installed after
// launch via CDP (scripts/load-extension.mjs), which needs the unsafe
// extension debugging switch.
const args = [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE_DIR}`,
  "--enable-unsafe-extension-debugging",
  "--silent-debugger-extension-api",
  "--no-first-run",
  "--no-default-browser-check",
  START_URL,
];

console.log(`Chrome debug profile: ${PROFILE_DIR}`);
console.log(`CDP endpoint:         http://127.0.0.1:${PORT}`);
console.log(`Extension:            ${EXTENSION_DIR}`);
console.log("\nLog into Jira once in this window; the profile persists.\n");

// stdio must not be inherited, or this script stays attached until Chrome exits.
const child = spawn(CHROME, args, { stdio: "ignore", detached: true });
child.unref();

// CDP-installed extensions do not survive a restart, so install on every launch.
const endpoint = `http://127.0.0.1:${PORT}/json/version`;
for (let attempt = 0; attempt < 40; attempt += 1) {
  await new Promise((r) => setTimeout(r, 500));
  try {
    const res = await fetch(endpoint);
    if (!res.ok) continue;
  } catch {
    continue;
  }

  const { chromium } = await import("playwright-core");
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  const session = await browser.newBrowserCDPSession();
  try {
    const { id } = await session.send("Extensions.loadUnpacked", {
      path: EXTENSION_DIR,
    });
    console.log(`Extension installed: ${id}`);
  } catch (e) {
    console.error(
      `Could not install the extension automatically (${e.message}).\n` +
        `Open chrome://extensions, enable Developer mode, Load unpacked: ${EXTENSION_DIR}`,
    );
  }
  await browser.close();
  break;
}
