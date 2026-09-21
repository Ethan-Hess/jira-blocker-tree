#!/usr/bin/env node
/**
 * Connect to the debug Chrome over CDP and report what the extension is doing:
 * console output, page errors, whether the launcher and drawer mounted, and a
 * screenshot written to .devtools/.
 *
 * Usage:
 *   node scripts/inspect.mjs                 # inspect current Jira tab
 *   node scripts/inspect.mjs --reload        # reload the page first
 *   node scripts/inspect.mjs --open          # click the Blockers button
 *   node scripts/inspect.mjs --url=<issue>   # navigate to an issue first
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, ".devtools");
const PORT = process.env.CDP_PORT ?? "9222";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const JIRA_HOST = "your-site.atlassian.net";

function truncate(text, max = 300) {
  const clean = String(text).replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`).catch((e) => {
  console.error(
    `Could not connect to Chrome on port ${PORT}.\nRun "npm run chrome" first.\n\n${e.message}`,
  );
  process.exit(1);
});

const context = browser.contexts()[0];
if (!context) {
  console.error("No browser context found.");
  process.exit(1);
}

let page =
  context.pages().find((p) => p.url().includes(JIRA_HOST)) ??
  context.pages().find((p) => !p.url().startsWith("chrome-extension://"));

const targetUrl = value("url");
if (!page) {
  page = await context.newPage();
  await page.goto(targetUrl ?? `https://${JIRA_HOST}/browse/ISSUE-KEY`);
}

const consoleLines = [];
const pageErrors = [];

page.on("console", (msg) => {
  consoleLines.push(`[${msg.type()}] ${truncate(msg.text())}`);
});
page.on("pageerror", (err) => {
  pageErrors.push(truncate(err.message));
});

// Extension service worker logs surface here.
for (const worker of context.serviceWorkers()) {
  if (worker.url().startsWith("chrome-extension://")) {
    consoleLines.push(`[sw] active: ${worker.url()}`);
  }
}

if (targetUrl) {
  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
} else if (flag("reload")) {
  await page.reload({ waitUntil: "domcontentloaded" });
}

await page.waitForTimeout(flag("reload") || targetUrl ? 4000 : 1200);

const launcher = page.locator("#jbt-launcher-slot button");
const launcherCount = await launcher.count();

if (flag("open") && launcherCount > 0) {
  const open = await launcher.first().getAttribute("data-jbt-open");
  if (open !== "true") {
    await launcher.first().click();
  }
  await page.waitForTimeout(2500);
}

const diagnostics = await page.evaluate(() => {
  const host = document.getElementById("jbt-panel-host");
  const shadow = host?.shadowRoot ?? null;
  const drawer = shadow?.querySelector(".jbt-drawer") ?? null;
  const rows = shadow?.querySelectorAll(".jbt-row") ?? [];
  const banner = shadow?.querySelector(".jbt-banner");
  const meta = shadow?.querySelector(".jbt-meta");
  const treeHeader = shadow?.querySelector(".jbt-tree-header");
  const viewToggle = shadow?.querySelector(".jbt-view-toggle");
  const slot = document.getElementById("jbt-launcher-slot");

  return {
    panelHostPresent: Boolean(host),
    shadowRootPresent: Boolean(shadow),
    drawerOpen: Boolean(drawer),
    rowCount: rows.length,
    sortableTreeHeader: Boolean(treeHeader),
    viewTogglePresent: Boolean(viewToggle),
    banner: banner?.textContent?.trim() ?? null,
    meta: meta?.textContent?.trim() ?? null,
    launcherSlotPresent: Boolean(slot),
    launcherParentTestId:
      slot?.previousElementSibling?.getAttribute("data-testid") ?? null,
    url: window.location.href,
  };
});

mkdirSync(OUT_DIR, { recursive: true });
const shotPath = resolve(OUT_DIR, "shot.png");
await page.screenshot({ path: shotPath, fullPage: false });

console.log("\n=== Page ===");
console.log(diagnostics.url);

console.log("\n=== Extension mount ===");
console.log(`launcher button in header : ${launcherCount > 0 ? "yes" : "NO"}`);
console.log(`launcher slot present     : ${diagnostics.launcherSlotPresent}`);
console.log(`slot anchored after       : ${diagnostics.launcherParentTestId ?? "n/a"}`);
console.log(`panel host + shadow root  : ${diagnostics.panelHostPresent} / ${diagnostics.shadowRootPresent}`);
console.log(`drawer open               : ${diagnostics.drawerOpen}`);
console.log(`tree rows rendered        : ${diagnostics.rowCount}`);
console.log(`sortable tree header      : ${diagnostics.sortableTreeHeader ? "yes" : "no"}`);
console.log(`view toggle               : ${diagnostics.viewTogglePresent ? "yes" : "no"}`);
if (diagnostics.meta) console.log(`meta                      : ${diagnostics.meta}`);
if (diagnostics.banner) console.log(`banner                    : ${diagnostics.banner}`);

if (pageErrors.length) {
  console.log("\n=== Page errors ===");
  pageErrors.forEach((e) => console.log(`  ${e}`));
}

const relevant = consoleLines.filter(
  (line) => !line.includes("[debug]") && !line.includes("Download the React DevTools"),
);
if (relevant.length) {
  console.log("\n=== Console ===");
  relevant.slice(-25).forEach((line) => console.log(`  ${line}`));
}

console.log(`\nScreenshot: ${shotPath}\n`);

await browser.close();
