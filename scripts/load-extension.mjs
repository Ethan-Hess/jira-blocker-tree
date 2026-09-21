#!/usr/bin/env node
/**
 * Install dist/ as an unpacked extension over CDP.
 *
 * Chrome 137 removed the --load-extension command line switch, so the browser
 * is launched clean and the extension is installed through the CDP Extensions
 * domain instead (requires --enable-unsafe-extension-debugging).
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSION_DIR = resolve(ROOT, "dist");
const PORT = process.env.CDP_PORT ?? "9222";

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`).catch((e) => {
  console.error(`Cannot reach Chrome on ${PORT}. Run "npm run chrome" first.\n${e.message}`);
  process.exit(1);
});

const session = await browser.newBrowserCDPSession();

try {
  const result = await session.send("Extensions.loadUnpacked", {
    path: EXTENSION_DIR,
  });
  console.log(`Loaded unpacked extension: ${result.id}`);
} catch (e) {
  console.error(`Extensions.loadUnpacked failed: ${e.message}`);
  console.error(
    "\nFallback: in the debug Chrome window open chrome://extensions,\n" +
      `enable Developer mode, click "Load unpacked" and choose:\n  ${EXTENSION_DIR}\n` +
      "The debug profile persists, so this is only needed once.",
  );
  await browser.close();
  process.exit(1);
}

await browser.close();
