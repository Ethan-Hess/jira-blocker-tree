#!/usr/bin/env node
/**
 * Procedural extension icons: soft Atlassian-blue rounded square with a
 * four-brick wall (top brick falling). Writes:
 *   public/icons/icon-master.png (1024)
 *   public/icons/icon{16,48,128}.png
 *
 * Run: npm run icons
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

const MASTER_SIZE = 1024;
const EXPORT_SIZES = [16, 48, 128];

/** Atlassian blues (soft center glow). */
const BG_CENTER = [56, 146, 255];
const BG_EDGE = [0, 82, 204];
const BRICK = [255, 255, 255];
const SHADOW = [0, 45, 130];


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

function encodePng(size, rgba) {
  const stride = size * 4 + 1;
  const filtered = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    const row = y * stride;
    filtered[row] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * size * 4, size * 4).copy(
      filtered,
      row + 1,
    );
  }
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(filtered, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(c0, c1, t) {
  return [
    Math.round(lerp(c0[0], c1[0], t)),
    Math.round(lerp(c0[1], c1[1], t)),
    Math.round(lerp(c0[2], c1[2], t)),
  ];
}

function blend(px, size, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= size || y >= size || alpha <= 0) return;
  const i = (y * size + x) * 4;
  const a = Math.min(1, alpha);
  const oa = px[i + 3] / 255;
  const outA = a + oa * (1 - a);
  if (outA <= 0) return;
  px[i] = Math.round((color[0] * a + px[i] * oa * (1 - a)) / outA);
  px[i + 1] = Math.round((color[1] * a + px[i + 1] * oa * (1 - a)) / outA);
  px[i + 2] = Math.round((color[2] * a + px[i + 2] * oa * (1 - a)) / outA);
  px[i + 3] = Math.round(outA * 255);
}

/** Signed distance to rounded rect centered at origin, size w×h, corner r. */
function sdRoundRect(px, py, w, h, r) {
  const bx = Math.abs(px) - (w / 2 - r);
  const by = Math.abs(py) - (h / 2 - r);
  const ox = Math.max(bx, 0);
  const oy = Math.max(by, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(bx, by), 0) - r;
}

function fillBackground(px, size) {
  const cornerR = size * 0.22;
  const samples = size >= 256 ? 4 : 3;
  const inv = 1 / samples;
  const cx = size / 2;
  const cy = size / 2;
  // Radial falloff matches the generated art (brighter center, deeper edges).
  const maxDist = Math.hypot(cx, cy) * 0.92;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hit = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const lx = x + (sx + 0.5) * inv - cx;
          const ly = y + (sy + 0.5) * inv - cy;
          if (sdRoundRect(lx, ly, size, size, cornerR) <= 0) hit += 1;
        }
      }
      const a = hit / (samples * samples);
      if (a <= 0) continue;
      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / maxDist;
      const t = Math.min(1, dist * dist);
      const color = mixColor(BG_CENTER, BG_EDGE, t);
      blend(px, size, x, y, color, a);
    }
  }
}

function drawShape(px, size, cx, cy, w, h, r, deg, color, samples, alphaScale) {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const pad = Math.ceil(Math.hypot(w, h) / 2 + 3);
  const inv = 1 / samples;
  const rotated = deg !== 0;
  for (let y = Math.floor(cy) - pad; y <= Math.ceil(cy) + pad; y++) {
    for (let x = Math.floor(cx) - pad; x <= Math.ceil(cx) + pad; x++) {
      let hit = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const wx = x + (sx + 0.5) * inv - cx;
          const wy = y + (sy + 0.5) * inv - cy;
          let lx = wx;
          let ly = wy;
          if (rotated) {
            lx = wx * cos + wy * sin;
            ly = -wx * sin + wy * cos;
          }
          if (sdRoundRect(lx, ly, w, h, r) <= 0) hit += 1;
        }
      }
      const a = (hit / (samples * samples)) * alphaScale;
      if (a > 0) blend(px, size, x, y, color, a);
    }
  }
}

/** Soft rounded brick (not a full capsule) + light drop shadow. */
function drawBrickSoft(px, size, cx, cy, w, h, r, deg, samples) {
  const shadowOx = size * 0.007;
  const shadowOy = size * 0.011;
  drawShape(px, size, cx + shadowOx, cy + shadowOy, w, h, r, deg, SHADOW, samples, 0.22);
  drawShape(px, size, cx, cy, w, h, r, deg, BRICK, samples, 1);
}

/**
 * Four soft bricks: bottom pair, centered middle, tilted falling top.
 * After placing, shift so the full AABB (including the tilted brick) is centered.
 */
function drawIcon(size) {
  const px = new Uint8Array(size * size * 4);
  fillBackground(px, size);

  const brickW = size * 0.338;
  const brickH = size * 0.171;
  const gap = size * 0.033;
  const brickR = brickH * 0.14;
  const samples = size >= 256 ? 5 : size >= 48 ? 3 : 2;

  const rowPitch = brickH + gap;
  const midCy = size * 0.5;
  const bottomCy = midCy + rowPitch;
  const topCy = midCy - rowPitch;

  const bricks = [
    { cx: size / 2 - (brickW + gap) / 2, cy: bottomCy, deg: 0 },
    { cx: size / 2 + (brickW + gap) / 2, cy: bottomCy, deg: 0 },
    { cx: size / 2, cy: midCy, deg: 0 },
  ];
  // Falling brick is placed after centering so nudging it does not move the stack.
  const falling = {
    cx: size / 2 + brickW * 0.42,
    cy: topCy + brickH * 0.06,
    deg: 20,
  };

  // Center on the stable three bricks only.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const b of bricks) {
    const hw = brickW / 2;
    const hh = brickH / 2;
    minX = Math.min(minX, b.cx - hw);
    maxX = Math.max(maxX, b.cx + hw);
    minY = Math.min(minY, b.cy - hh);
    maxY = Math.max(maxY, b.cy + hh);
  }
  // Include falling brick vertically so the full composition stays optically centered.
  {
    const rad = (falling.deg * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const hw = brickW / 2;
    const hh = brickH / 2;
    for (const [lx, ly] of [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ]) {
      const wy = lx * s + ly * c + falling.cy;
      minY = Math.min(minY, wy);
      maxY = Math.max(maxY, wy);
    }
  }

  const shiftX = size / 2 - (minX + maxX) / 2;
  const shiftY = size / 2 - (minY + maxY) / 2 - size * 0.02;

  for (const b of bricks) {
    drawBrickSoft(
      px,
      size,
      b.cx + shiftX,
      b.cy + shiftY,
      brickW,
      brickH,
      brickR,
      b.deg,
      samples,
    );
  }
  drawBrickSoft(
    px,
    size,
    falling.cx + shiftX,
    falling.cy + shiftY,
    brickW,
    brickH,
    brickR,
    falling.deg,
    samples,
  );

  return px;
}

/** Area-average downsample (keeps soft edges when exporting small sizes). */
function downsample(src, srcSize, dstSize) {
  const dst = new Uint8Array(dstSize * dstSize * 4);
  const scale = srcSize / dstSize;
  for (let y = 0; y < dstSize; y++) {
    for (let x = 0; x < dstSize; x++) {
      const x0 = Math.floor(x * scale);
      const y0 = Math.floor(y * scale);
      const x1 = Math.min(srcSize, Math.ceil((x + 1) * scale));
      const y1 = Math.min(srcSize, Math.ceil((y + 1) * scale));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * srcSize + sx) * 4;
          const alpha = src[i + 3] / 255;
          r += src[i] * alpha;
          g += src[i + 1] * alpha;
          b += src[i + 2] * alpha;
          a += alpha;
          n += 1;
        }
      }
      const di = (y * dstSize + x) * 4;
      if (a <= 0 || n === 0) continue;
      dst[di] = Math.round(r / a);
      dst[di + 1] = Math.round(g / a);
      dst[di + 2] = Math.round(b / a);
      dst[di + 3] = Math.round((a / n) * 255);
    }
  }
  return dst;
}

function writeIcon(path, size, rgba) {
  const buf = encodePng(size, rgba);
  writeFileSync(path, buf);
  const hash = createHash("sha256").update(buf).digest("hex").slice(0, 8);
  console.log(`Wrote ${path} (${size}x${size}, sha256:${hash}…)`);
}

mkdirSync(OUT, { recursive: true });
console.log(`Rendering master ${MASTER_SIZE}×${MASTER_SIZE}…`);
const master = drawIcon(MASTER_SIZE);
writeIcon(resolve(OUT, "icon-master.png"), MASTER_SIZE, master);

for (const size of EXPORT_SIZES) {
  const rgba = downsample(master, MASTER_SIZE, size);
  writeIcon(resolve(OUT, `icon${size}.png`), size, rgba);
}
