#!/usr/bin/env node
/**
 * Zip dist/ for Chrome Web Store upload (manifest at archive root).
 * Usage: node scripts/zip-dist.mjs [output-path]
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(ROOT, "dist");
const outArg = process.argv[2];
const OUT = resolve(outArg ?? join(ROOT, "jira-blocker-tree.zip"));
mkdirSync(dirname(OUT), { recursive: true });

if (!existsSync(DIST)) {
  console.error(`Missing ${DIST}. Run npm run build first.`);
  process.exit(1);
}

copyFileSync(join(ROOT, "LICENSE"), join(DIST, "LICENSE"));
copyFileSync(join(ROOT, "NOTICE"), join(DIST, "NOTICE"));

const zipCheck = spawnSync("zip", ["-v"], { encoding: "utf8" });
if (zipCheck.status !== 0) {
  console.error("The `zip` command is required (install on macOS via Xcode CLT).");
  process.exit(1);
}

const result = spawnSync("zip", ["-r", "-q", OUT, "."], { cwd: DIST, encoding: "utf8" });
if (result.status !== 0) {
  console.error(result.stderr || "zip failed");
  process.exit(1);
}

console.log(OUT);
