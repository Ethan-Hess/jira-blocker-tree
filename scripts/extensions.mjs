#!/usr/bin/env node
/** Screenshot chrome://extensions and dump loaded extension state. */
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, ".devtools");
const PORT = process.env.CDP_PORT ?? "9222";

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const context = browser.contexts()[0];
const page = await context.newPage();

await page.goto("chrome://extensions");
await page.waitForTimeout(2000);

const data = await page.evaluate(() => {
  const deepItems = (root, acc = []) => {
    if (!root) return acc;
    for (const el of root.querySelectorAll("*")) {
      if (el.tagName?.toLowerCase() === "extensions-item") acc.push(el);
      if (el.shadowRoot) deepItems(el.shadowRoot, acc);
    }
    return acc;
  };

  const items = deepItems(document);
  return items.map((item) => {
    const sr = item.shadowRoot;
    return {
      id: item.id,
      name: sr?.querySelector("#name")?.textContent?.trim() ?? null,
      version: sr?.querySelector("#version")?.textContent?.trim() ?? null,
      enabled: sr?.querySelector("#enableToggle")?.getAttribute("aria-pressed") ?? null,
      hasErrors: Boolean(sr?.querySelector("#errors-button")),
    };
  });
});

console.log(JSON.stringify(data, null, 2));

mkdirSync(OUT_DIR, { recursive: true });
const shot = resolve(OUT_DIR, "extensions.png");
await page.screenshot({ path: shot });
console.log(`Screenshot: ${shot}`);

await page.close();
await browser.close();
