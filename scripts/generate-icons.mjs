#!/usr/bin/env node
/**
 * Writes public/icons/icon{16,48,128}.png for the Chrome Web Store and manifest.
 * Run: node scripts/generate-icons.mjs
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

const BG = [37, 99, 235]; // blue-600
const FG = [255, 255, 255];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function drawTree(size) {
  const px = new Uint8Array(size * size * 4);
  const pad = Math.max(1, Math.round(size * 0.12));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const inBox = x >= pad && x < size - pad && y >= pad && y < size - pad;
      if (!inBox) {
        px[i + 3] = 0;
        continue;
      }
      const lx = x - pad;
      const ly = y - pad;
      const w = size - pad * 2;
      const h = size - pad * 2;
      const barH = Math.max(1, Math.round(h * 0.14));
      const gap = Math.max(1, Math.round(h * 0.08));
      const stemW = Math.max(1, Math.round(w * 0.22));
      const stemX = Math.round(w * 0.12);
      const bars = [
        { y0: 0, w: Math.round(w * 0.55) },
        { y0: barH + gap, w: Math.round(w * 0.78) },
        { y0: (barH + gap) * 2, w: Math.round(w * 0.95) },
      ];
      let on = false;
      for (const bar of bars) {
        if (ly >= bar.y0 && ly < bar.y0 + barH && lx >= stemX && lx < stemX + bar.w) {
          on = true;
          break;
        }
      }
      const stemTop = (barH + gap) * 2 + barH;
      if (ly >= stemTop && ly < h && lx >= stemX && lx < stemX + stemW) {
        on = true;
      }
      const color = on ? FG : BG;
      px[i] = color[0];
      px[i + 1] = color[1];
      px[i + 2] = color[2];
      px[i + 3] = 255;
    }
  }
  return px;
}

function png(size) {
  const raw = drawTree(size);
  const stride = size * 4 + 1;
  const filtered = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    const row = y * stride;
    filtered[row] = 0;
    for (let x = 0; x < size * 4; x++) {
      filtered[row + 1 + x] = raw[y * size * 4 + x];
    }
  }
  const compressed = deflateSync(filtered);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
for (const size of [16, 48, 128]) {
  const file = resolve(OUT, `icon${size}.png`);
  writeFileSync(file, png(size));
  const hash = createHash("sha256").update(png(size)).digest("hex").slice(0, 8);
  console.log(`Wrote ${file} (${size}x${size}, sha256:${hash}…)`);
}
