#!/usr/bin/env node
// Scaffolds a new flower species: a starter SVG (edit the shape by hand
// afterward) + a matching entry appended to src/content/flowers.json.
// Usage: npm run new-flower -- <id> "<Display Name>" "<meaning>" <fillHex> <fillDeepHex> <centerHex>

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [id, name, meaning, fill = '#E2496B', fillDeep = '#B02F52', center = '#7C2039'] = process.argv.slice(2);

if (!id || !name || !meaning) {
  console.error('Usage: npm run new-flower -- <id> "<Display Name>" "<meaning>" [fillHex] [fillDeepHex] [centerHex]');
  process.exit(1);
}

const svgPath = path.join(root, 'src', 'assets', 'svg', 'flowers', `${id}.svg`);
if (existsSync(svgPath)) {
  console.error(`Refusing to overwrite existing file: ${svgPath}`);
  process.exit(1);
}

// A plain 6-petal starter — see docs/flower-art-guide.md for the full
// authoring conventions (viewBox, stem anchor, shadow/fill/line layering).
const starterSvg = `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <path id="${id}-petal" d="M80,80 C63,73 52,50 61,29 C67,15 93,15 99,29 C108,50 97,73 80,80 Z"/>
  </defs>
  <circle cx="80" cy="83" r="50" fill="var(--bloom-fill-deep)" opacity="0.25"/>
  <g fill="var(--bloom-fill)" stroke="var(--color-line)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
    <use href="#${id}-petal" transform="rotate(0 80 80)"/>
    <use href="#${id}-petal" transform="rotate(60 80 80)"/>
    <use href="#${id}-petal" transform="rotate(120 80 80)"/>
    <use href="#${id}-petal" transform="rotate(180 80 80)"/>
    <use href="#${id}-petal" transform="rotate(240 80 80)"/>
    <use href="#${id}-petal" transform="rotate(300 80 80)"/>
  </g>
  <circle cx="80" cy="80" r="7" fill="var(--bloom-center)"/>
</svg>
`;
writeFileSync(svgPath, starterSvg);

const flowersJsonPath = path.join(root, 'src', 'content', 'flowers.json');
const flowers = JSON.parse(readFileSync(flowersJsonPath, 'utf8'));
if (flowers.some((f) => f.id === id)) {
  console.error(`flowers.json already has an entry with id "${id}"`);
  process.exit(1);
}
flowers.push({
  id,
  name,
  meaning,
  footprintRadius: 38,
  layerBias: 'mid',
  fill,
  fillDeep,
  center,
});
writeFileSync(flowersJsonPath, JSON.stringify(flowers, null, 2) + '\n');

console.log(`Added "${id}" to flowers.json and created ${path.relative(root, svgPath)}`);
console.log('Next: open the SVG and replace the starter petal path with real artwork.');
