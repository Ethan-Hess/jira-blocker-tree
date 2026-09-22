#!/usr/bin/env node
/**
 * Capture Chrome Web Store screenshots (1280x800) from the debug Chrome with
 * issue keys, summaries, and assignee initials obscured, so no real Jira data
 * is published.
 *
 * Redaction uses transparent text plus a text-shadow rather than filter:blur.
 * A filter on hundreds of rows needs one render surface each and Chrome drops
 * them during captureScreenshot, which silently produces a readable shot.
 *
 * Usage:
 *   node scripts/store-shots.mjs --key=JET-69117
 *   node scripts/store-shots.mjs --key=JET-69117 --out=store-assets
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { jiraOrigin } from "./jiraOrigin.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.CDP_PORT ?? "9222";
const WIDTH = 1280;
const HEIGHT = 800;

const argv = process.argv.slice(2);
const value = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const ISSUE_KEY = value("key") ?? "JET-69117";
const OUT_DIR = resolve(ROOT, value("out") ?? "store-assets");
const ISSUE_URL = `${jiraOrigin()}/browse/${ISSUE_KEY}`;

const PANEL_MASK_CSS = `
.jbt-key, .jbt-pedigree-node-top .jbt-key {
  color: transparent !important;
  text-shadow: 0 0 6px var(--jbt-link), 0 0 10px var(--jbt-link) !important;
}
.jbt-summary, .jbt-pedigree-summary, .jbt-input {
  color: transparent !important;
  text-shadow: 0 0 6px var(--jbt-text), 0 0 11px var(--jbt-text) !important;
}
.jbt-subtitle {
  color: transparent !important;
  text-shadow: 0 0 6px var(--jbt-subtle), 0 0 10px var(--jbt-subtle) !important;
}
.jbt-avatar {
  color: transparent !important;
  text-shadow: 0 0 5px var(--jbt-avatar-fg), 0 0 8px var(--jbt-avatar-fg) !important;
}
`;

/** Jira itself: blur everything except the extension host. */
const PAGE_BLUR_CSS = `
body > *:not(#jbt-panel-host) { filter: blur(9px) !important; }
`;

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`).catch((e) => {
  console.error(`Could not connect on port ${PORT}. Run "npm run chrome" first.\n${e.message}`);
  process.exit(1);
});

const context = browser.contexts()[0];
const page =
  context.pages().find((p) => !p.url().startsWith("chrome-extension://")) ??
  (await context.newPage());
const cdp = await context.newCDPSession(page);

// Resize the real window: Playwright's screenshot clears Emulation overrides.
const { windowId } = await cdp.send("Browser.getWindowForTarget");
for (let i = 0; i < 5; i += 1) {
  const inner = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  const dw = WIDTH - inner.w;
  const dh = HEIGHT - inner.h;
  if (Math.abs(dw) <= 1 && Math.abs(dh) <= 1) break;
  const { bounds } = await cdp.send("Browser.getWindowBounds", { windowId });
  await cdp.send("Browser.setWindowBounds", {
    windowId,
    bounds: { width: bounds.width + dw, height: bounds.height + dh },
  });
  await page.waitForTimeout(500);
}
const viewport = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
console.log(`viewport: ${viewport.w}x${viewport.h}`);

await page.goto(ISSUE_URL, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);

const launcher = page.locator("#jbt-launcher-slot button");
await launcher.first().waitFor({ timeout: 25000 });
if ((await launcher.first().getAttribute("data-jbt-open")) !== "true") {
  await launcher.first().click();
}

// The tree loads breadth-first, one level per request.
await page.waitForFunction(
  () => {
    const shadow = document.getElementById("jbt-panel-host")?.shadowRoot;
    return (shadow?.querySelectorAll(".jbt-row").length ?? 0) > 3;
  },
  { timeout: 45000 },
);
await page.waitForTimeout(3000);

/** Re-applied before every shot: React re-renders restore the focus key text. */
async function redact(pageBlur = true) {
  await page.evaluate(
    ({ panelCss, pageCss, pageBlur }) => {
      const shadow = document.getElementById("jbt-panel-host")?.shadowRoot;
      if (shadow && !shadow.querySelector("#jbt-shot-mask")) {
        const style = document.createElement("style");
        style.id = "jbt-shot-mask";
        style.textContent = panelCss;
        shadow.appendChild(style);
      }
      if (pageBlur && !document.getElementById("jbt-shot-page-blur")) {
        const style = document.createElement("style");
        style.id = "jbt-shot-page-blur";
        style.textContent = pageCss;
        document.head.appendChild(style);
      }
      // "97 issues loaded · 161 shown · focus JET-1234" leaks a key as plain text.
      const meta = shadow?.querySelector(".jbt-meta");
      if (meta?.textContent?.includes("focus")) {
        meta.textContent = meta.textContent.replace(/\s*·\s*focus.*$/, "");
      }
    },
    { panelCss: PANEL_MASK_CSS, pageCss: PAGE_BLUR_CSS, pageBlur },
  );
  await page.waitForTimeout(300);
}

mkdirSync(OUT_DIR, { recursive: true });

async function shot(name, clip, pageBlur = true) {
  await redact(pageBlur);
  const path = resolve(OUT_DIR, name);
  await page.screenshot({ path, scale: "css", clip });
  console.log(`wrote ${path}`);
}

async function clickPanel(selector) {
  await page.evaluate((sel) => {
    const shadow = document.getElementById("jbt-panel-host")?.shadowRoot;
    shadow?.querySelector(sel)?.click();
  }, selector);
  await page.waitForTimeout(1200);
}

await shot("01-tree.png");

await clickPanel(".jbt-toolbar .jbt-checkbox input");
await shot("02-tree-hide-done.png");
await clickPanel(".jbt-toolbar .jbt-checkbox input");

await clickPanel('.jbt-view-toggle button[role="tab"]:last-of-type');
await page.waitForTimeout(2000);
await shot("03-lineage.png");

await clickPanel(".jbt-pedigree-toolbar .jbt-view-toggle button:last-of-type");
await shot("04-lineage-left-right.png");

await clickPanel('.jbt-toolbar .jbt-view-toggle button[role="tab"]:first-of-type');

// Detail crop of the header launcher. A filter cannot be undone on a
// descendant, so blur each sibling along the launcher's ancestor path instead
// of the page root, which leaves only the button sharp.
await page.evaluate(() => {
  document.getElementById("jbt-shot-page-blur")?.remove();
  let node = document.getElementById("jbt-launcher-slot");
  while (node && node !== document.body) {
    for (const sibling of node.parentElement?.children ?? []) {
      if (sibling !== node && sibling.id !== "jbt-panel-host") {
        sibling.style.filter = "blur(9px)";
      }
    }
    node = node.parentElement;
  }
});
await page.waitForTimeout(400);

const slotBox = await page.locator("#jbt-launcher-slot").boundingBox();
if (slotBox) {
  await shot(
    "05-launcher.png",
    {
      x: Math.max(0, Math.min(slotBox.x + slotBox.width / 2 - 320, WIDTH - 640)),
      y: Math.max(0, slotBox.y + slotBox.height / 2 - 140),
      width: 640,
      height: 400,
    },
    false,
  );
}

await browser.close();
