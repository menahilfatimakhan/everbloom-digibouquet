// The source art in assets/Flowers&Leaves/ is not actually transparent: every
// pixel is opaque and the "transparency checkerboard" is painted into the
// image (the generator rendered the indicator instead of writing an alpha
// channel). sharp's trim() therefore finds nothing to trim, and tracing the
// files directly would vectorize the checker squares along with the flower.
//
// This module reconstructs the alpha channel in three steps:
//
//   1. Mark every pixel that carries either checker grey.
//   2. Flood-fill those inward from the image border. This gets the outline
//      exactly right, because it stops at the artwork's ink linework the same
//      way a paint-bucket would — pale petals stay untouched however closely
//      their white matches the light squares.
//   3. Recover background the fill couldn't reach — the checker enclosed by
//      the eucalyptus and fern sprays — by testing each enclosed region for
//      alternation.
//
// Step 3 is what separates enclosed *background* from enclosed *artwork*: real
// checker draws on both greys in roughly equal measure, whereas an enclosed
// white petal only ever matches the light one. Earlier attempts gated on how
// much of a grid cell looked like checker instead, and no single threshold
// worked for both — the eucalyptus centre needs a permissive one, the daisy's
// petals a strict one.

/** How far a pixel may sit from a checker level to still count as background. */
const LEVEL_TOL = 16;

/** Fallback levels, used only if the pair can't be read off an image. */
const DEFAULT_LEVELS = { light: 254, dark: 205 };

/**
 * Reads the two greys this particular export used for its checkerboard.
 *
 * Most of the set uses 254/205, but not all of them — one bow ships with a
 * much lighter 253/232 pair, and against hardcoded levels its dark squares
 * fell outside tolerance, so the mask kept the entire background and the trace
 * came out as a bow on a grey slab.
 *
 * Sampled from a frame around the border rather than the whole image: the
 * artwork is always inset from the edges, so the border is background by
 * construction, whereas a whole-image histogram can be swayed by art that is
 * itself largely neutral (the cream bow, the twine, the glass vase).
 */
function detectLevels(data, width, height) {
  const band = Math.max(2, Math.round(Math.min(width, height) * 0.06));
  const histogram = new Float64Array(256);
  const consider = (x, y) => {
    const p = (y * width + x) * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) > NEUTRAL_TOL) return;
    histogram[Math.round((r + g + b) / 3)]++;
  };
  for (let y = 0; y < height; y++) {
    const edgeRow = y < band || y >= height - band;
    for (let x = 0; x < width; x++) {
      if (edgeRow || x < band || x >= width - band) consider(x, y);
    }
  }

  const peak = (exclude) => {
    let best = -1;
    let bestCount = 0;
    for (let v = 0; v < 256; v++) {
      if (exclude >= 0 && Math.abs(v - exclude) <= 20) continue;
      if (histogram[v] > bestCount) {
        bestCount = histogram[v];
        best = v;
      }
    }
    return { value: best, count: bestCount };
  };

  const first = peak(-1);
  const second = peak(first.value);
  if (first.value < 0 || second.value < 0 || second.count < first.count * 0.15) {
    return DEFAULT_LEVELS;
  }
  return {
    light: Math.max(first.value, second.value),
    dark: Math.min(first.value, second.value),
  };
}

/** Max channel spread before a pixel reads as colored artwork rather than
 * neutral checker. Pale petal tints keep a visible red-over-green bias, so
 * this cleanly separates them from grey. */
const NEUTRAL_TOL = 14;

/** An enclosed region must draw at least this share of its pixels from each
 * checker level to be accepted as background. Genuine checker sits near 0.5;
 * artwork that merely happens to be neutral sits near 0. */
const ALTERNATION_MIN = 0.15;

/**
 * Rebuilds the background mask for one image.
 * @param {Buffer} data raw RGBA
 * @param {number} dilate pixels to grow the mask by, to swallow the
 *   anti-aliased checker/art boundary that would otherwise trace as a pale
 *   halo ring around the bloom.
 * @returns {Uint8Array} 1 = background
 */
export function checkerMask(data, width, height, dilate = 2) {
  const n = width * height;
  const { light: LIGHT, dark: DARK } = detectLevels(data, width, height);

  // --- 1. classify by color alone ----------------------------------------
  // Deliberately no attempt to predict which grey belongs at a given (x,y).
  // These exports only approximate a checkerboard: transitions go missing
  // mid-row (at y=480 in Lily.png the boundary at x=307 simply isn't there),
  // so parity breaks at irregular places in both axes and every global phase
  // model mispredicts somewhere. Matching either grey needs no phase at all;
  // the structure is recovered later, from connectivity and alternation.
  //
  /** 0 = not checker-colored, 1 = light grey, 2 = dark grey. */
  const matched = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) > NEUTRAL_TOL) continue;
    const v = (r + g + b) / 3;
    if (Math.abs(v - LIGHT) <= LEVEL_TOL) matched[i] = 1;
    else if (Math.abs(v - DARK) <= LEVEL_TOL) matched[i] = 2;
  }

  // --- 2. fill inward from the border ------------------------------------
  const mask = new Uint8Array(n);
  const stack = [];
  const push = (i) => {
    if (mask[i] || !matched[i]) return;
    mask[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }
  // 8-connected on purpose. Adjacent squares are separated by a one-pixel
  // anti-aliased seam whose value (~236) falls in the gap between the two
  // levels, so a 4-connected fill treats every square as an island and only
  // ever clears the one it started in. Diagonal steps hop that seam at the
  // corners where four squares meet, which stitches the whole background
  // together without having to loosen the color test.
  while (stack.length) {
    const i = stack.pop();
    const x = i % width;
    const y = (i / width) | 0;
    const l = x > 0;
    const r = x < width - 1;
    const u = y > 0;
    const d = y < height - 1;
    if (l) push(i - 1);
    if (r) push(i + 1);
    if (u) push(i - width);
    if (d) push(i + width);
    if (l && u) push(i - width - 1);
    if (r && u) push(i - width + 1);
    if (l && d) push(i + width - 1);
    if (r && d) push(i + width + 1);
  }

  // --- 3. recover enclosed background ------------------------------------
  const seen = new Uint8Array(n);
  for (let start = 0; start < n; start++) {
    if (!matched[start] || mask[start] || seen[start]) continue;

    const region = [];
    let light = 0;
    let dark = 0;
    seen[start] = 1;
    const queue = [start];
    while (queue.length) {
      const i = queue.pop();
      region.push(i);
      if (matched[i] === 1) light++;
      else dark++;
      const x = i % width;
      const y = (i / width) | 0;
      const step = (j) => {
        if (seen[j] || !matched[j] || mask[j]) return;
        seen[j] = 1;
        queue.push(j);
      };
      const l = x > 0;
      const r = x < width - 1;
      const u = y > 0;
      const d = y < height - 1;
      if (l) step(i - 1);
      if (r) step(i + 1);
      if (u) step(i - width);
      if (d) step(i + width);
      if (l && u) step(i - width - 1);
      if (r && u) step(i - width + 1);
      if (l && d) step(i + width - 1);
      if (r && d) step(i + width + 1);
    }

    // Both greys present in quantity => enclosed checker. Otherwise it's a
    // neutral patch of the artwork itself, which must be left alone.
    if (Math.min(light, dark) / region.length < ALTERNATION_MIN) continue;
    for (const i of region) mask[i] = 1;
  }

  // --- 4. grow over the anti-aliased boundary ----------------------------
  for (let step = 0; step < dilate; step++) {
    const grown = mask.slice();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (mask[i]) continue;
        if (
          (x > 0 && mask[i - 1]) ||
          (x < width - 1 && mask[i + 1]) ||
          (y > 0 && mask[i - width]) ||
          (y < height - 1 && mask[i + width])
        ) {
          grown[i] = 1;
        }
      }
    }
    mask.set(grown);
  }

  return mask;
}

/** Tight bounds of the non-background pixels, used to crop away the wide empty
 * margin the sources ship with. */
export function contentBounds(mask, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { left: 0, top: 0, width, height };
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
