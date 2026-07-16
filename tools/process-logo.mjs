#!/usr/bin/env node
// Regenerates the site's logo/favicon assets from the real Everbloom logo
// in `assets/brand assets/everbloom.png`. That source file has a flat
// lavender background (no alpha) and the stamp's own interior happens to be
// a near-identical color, so a naive "key out this color everywhere" would
// also erase the inside of the stamp. Instead this flood-fills only the
// background *connected to the image edges*, then crops to content and
// derives the header/footer logo, favicon, and apple-touch-icon from that.
//
// Usage: node tools/process-logo.mjs

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SRC = 'assets/brand assets/everbloom.png';
const THRESHOLD = 18; // color distance tolerance for "is background"

mkdirSync('public/logo', { recursive: true });

const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

function idx(x, y) {
  return (y * width + x) * channels;
}
const bg = [data[0], data[1], data[2]];

function isBgColor(i) {
  const dr = data[i] - bg[0];
  const dg = data[i + 1] - bg[1];
  const db = data[i + 2] - bg[2];
  return Math.abs(dr) + Math.abs(dg) + Math.abs(db) < THRESHOLD;
}

const visited = new Uint8Array(width * height);
const queue = new Int32Array(width * height);
let head = 0,
  tail = 0;

function tryPush(x, y) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const p = y * width + x;
  if (visited[p]) return;
  if (!isBgColor(idx(x, y))) return;
  visited[p] = 1;
  queue[tail++] = p;
}

for (let x = 0; x < width; x++) {
  tryPush(x, 0);
  tryPush(x, height - 1);
}
for (let y = 0; y < height; y++) {
  tryPush(0, y);
  tryPush(width - 1, y);
}
while (head < tail) {
  const p = queue[head++];
  const x = p % width;
  const y = (p / width) | 0;
  tryPush(x + 1, y);
  tryPush(x - 1, y);
  tryPush(x, y + 1);
  tryPush(x, y - 1);
}

const rgba = Buffer.alloc(width * height * 4);
let minX = width,
  minY = height,
  maxX = -1,
  maxY = -1;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const p = y * width + x;
    const si = p * channels;
    const di = p * 4;
    rgba[di] = data[si];
    rgba[di + 1] = data[si + 1];
    rgba[di + 2] = data[si + 2];
    const alpha = visited[p] ? 0 : 255;
    rgba[di + 3] = alpha;
    if (alpha > 0) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

const margin = 6;
const cropX = Math.max(0, minX - margin);
const cropY = Math.max(0, minY - margin);
const cropW = Math.min(width, maxX + margin) - cropX;
const cropH = Math.min(height, maxY + margin) - cropY;

const trimmed = sharp(rgba, { raw: { width, height, channels: 4 } }).extract({
  left: cropX,
  top: cropY,
  width: cropW,
  height: cropH,
});
const trimmedBuffer = await trimmed.png().toBuffer();

await sharp(trimmedBuffer).resize({ height: 900 }).png().toFile('public/logo/everbloom-stamp.png');

await sharp(trimmedBuffer)
  .resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile('public/favicon.png');

await sharp(trimmedBuffer)
  .resize(160, 160, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: 10, bottom: 10, left: 10, right: 10, background: { r: 251, g: 243, b: 231, alpha: 1 } })
  .png()
  .toFile('public/apple-touch-icon.png');

console.log('Wrote public/logo/everbloom-stamp.png, public/favicon.png, public/apple-touch-icon.png');
