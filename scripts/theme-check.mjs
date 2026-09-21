#!/usr/bin/env node
/**
 * Visual checks for the launcher and drawer.
 *
 * Jira owns the data-color-mode attribute and resets it, so the page theme
 * cannot be forced from here. The launcher is a clone of a live Jira button,
 * so it themes with Jira by construction; this script compares its computed
 * styles against the donor instead. The drawer palette is checked by forcing
 * our own theme class inside the shadow root.
 */
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, ".devtools");
const PORT = process.env.CDP_PORT ?? "9222";
const ISSUE =
  process.argv[2] ?? "https://your-site.atlassian.net";

mkdirSync(OUT, { recursive: true });

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const context = browser.contexts()[0];
let page = context.pages().find((p) => p.url().includes("/browse/"));
if (!page) page = await context.newPage();

await page.goto(ISSUE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);

const setDrawer = async (open) => {
  const state = await page.evaluate((want) => {
    const btn = document.querySelector("#jbt-launcher-slot button");
    if (!btn) return "missing";
    const isOpen = btn.dataset.jbtOpen === "true";
    if (isOpen !== want) btn.click();
    return "ok";
  }, open);
  await page.waitForTimeout(open ? 3500 : 800);
  return state;
};

await setDrawer(false);

// 1. Compare launcher against the donor it was cloned from.
const comparison = await page.evaluate(() => {
  const ours = document.querySelector("#jbt-launcher-slot button");
  const donor = Array.from(
    document.querySelectorAll(
      '[data-testid="issue.views.issue-base.foundation.status.actions-wrapper"] button, [data-testid="ai-agents-button.button"]',
    ),
  ).find((b) => !b.closest("#jbt-launcher-slot"));

  const pick = (el) => {
    if (!el) return null;
    const s = getComputedStyle(el);
    return {
      height: s.height,
      padding: s.padding,
      borderRadius: s.borderRadius,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      color: s.color,
      background: s.backgroundColor,
    };
  };

  return {
    colorMode: document.documentElement.getAttribute("data-color-mode"),
    ours: pick(ours),
    donor: pick(donor),
  };
});

console.log(`Jira colour mode: ${comparison.colorMode}`);
console.log("\nlauncher vs donor button:");
for (const key of Object.keys(comparison.ours ?? {})) {
  const a = comparison.ours?.[key];
  const b = comparison.donor?.[key];
  console.log(`  ${key.padEnd(13)} ours=${String(a).padEnd(22)} donor=${b}${a === b ? "" : "   <-- differs"}`);
}

const btnBox = await page
  .locator("#jbt-launcher-slot button")
  .first()
  .boundingBox();
if (btnBox) {
  await page.screenshot({
    path: resolve(OUT, "button-row.png"),
    clip: {
      x: Math.max(0, btnBox.x - 420),
      y: Math.max(0, btnBox.y - 24),
      width: 620,
      height: btnBox.height + 48,
    },
  });
}

// 2. Drawer in Jira's current theme, then forced to our dark palette.
await setDrawer(true);
await page.screenshot({ path: resolve(OUT, "drawer-current.png") });

await page.evaluate(() => {
  const shadow = document.getElementById("jbt-panel-host")?.shadowRoot;
  shadow?.querySelectorAll(".jbt-root").forEach((el) => {
    el.classList.add("jbt-theme-dark");
  });
});
await page.waitForTimeout(500);
await page.screenshot({ path: resolve(OUT, "drawer-dark.png") });

await page.evaluate(() => {
  const shadow = document.getElementById("jbt-panel-host")?.shadowRoot;
  shadow?.querySelectorAll(".jbt-root").forEach((el) => {
    el.classList.remove("jbt-theme-dark");
  });
});

console.log(`\nScreenshots in ${OUT}`);
await browser.close();
