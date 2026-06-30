// Self-contained: all color math inlined so the worker bundle has no external deps.

interface WorkerColor {
  number: string;
  name: string;
  rgb: [number, number, number];
  lab: [number, number, number];
}

interface ChunkDef {
  index: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
}

interface ChunkResult {
  index: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
  colorIndices: Int16Array; // -1 = transparent/empty, else index into WorkerColor[]
}

type IncomingMessage =
  | { type: 'COUNT'; pixels: ArrayBuffer; imageWidth: number; colors: WorkerColor[] }
  | { type: 'MAP';   pixels: ArrayBuffer; imageWidth: number; chunks: ChunkDef[]; colors: WorkerColor[] };

// ── Color math ───────────────────────────────────────────────────────────────

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  let lr = r / 255, lg = g / 255, lb = b / 255;
  lr = lr > 0.04045 ? ((lr + 0.055) / 1.055) ** 2.4 : lr / 12.92;
  lg = lg > 0.04045 ? ((lg + 0.055) / 1.055) ** 2.4 : lg / 12.92;
  lb = lb > 0.04045 ? ((lb + 0.055) / 1.055) ** 2.4 : lb / 12.92;
  const x = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375;
  const y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750;
  const z = lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041;
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f(x / 0.95047), fy = f(y), fz = f(z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

// Squared delta-E (skip sqrt — we only need relative ordering)
function deltaESq(lab: [number, number, number], cL: number, ca: number, cb: number): number {
  const dL = lab[0] - cL, da = lab[1] - ca, db = lab[2] - cb;
  return dL * dL + da * da + db * db;
}

function findClosestIndex(
  r: number, g: number, b: number,
  colors: WorkerColor[],
  labValues: Float32Array, // flat [L0,a0,b0, L1,a1,b1, ...]
): number {
  const pLab = rgbToLab(r, g, b);
  let best = 0;
  let minDist = deltaESq(pLab, labValues[0], labValues[1], labValues[2]);
  for (let i = 1; i < colors.length; i++) {
    const oi = i * 3;
    const dist = deltaESq(pLab, labValues[oi], labValues[oi + 1], labValues[oi + 2]);
    if (dist < minDist) { minDist = dist; best = i; }
  }
  return best;
}

// ── Pass 1: count color usage across all pixels ───────────────────────────────

function handleCount(pixels: Uint8ClampedArray, colors: WorkerColor[]) {
  const labValues = buildLabValues(colors);
  // RGB lookup cache: packed 24-bit key → color index
  const rgbCache = new Map<number, number>();
  const counts: Record<string, number> = {};

  const total = pixels.length / 4;
  for (let i = 0; i < total; i++) {
    const base = i * 4;
    if (pixels[base + 3] < 128) continue;
    const r = pixels[base], g = pixels[base + 1], b = pixels[base + 2];
    const key = (r << 16) | (g << 8) | b;
    let ci = rgbCache.get(key);
    if (ci === undefined) {
      ci = findClosestIndex(r, g, b, colors, labValues);
      rgbCache.set(key, ci);
    }
    const num = colors[ci].number;
    counts[num] = (counts[num] ?? 0) + 1;
  }

  self.postMessage({ type: 'COUNT_RESULT', counts });
}

// ── Pass 2: map each chunk's pixels to color indices ─────────────────────────

function handleMap(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  chunks: ChunkDef[],
  colors: WorkerColor[],
) {
  const labValues = buildLabValues(colors);
  const rgbCache = new Map<number, number>(); // shared across chunks in this worker
  const results: ChunkResult[] = [];

  for (const { index, startX, startY, width, height } of chunks) {
    const colorIndices = new Int16Array(width * height);

    for (let cy = 0; cy < height; cy++) {
      for (let cx = 0; cx < width; cx++) {
        const base = ((startY + cy) * imageWidth + (startX + cx)) * 4;
        if (pixels[base + 3] < 128) {
          colorIndices[cy * width + cx] = -1;
          continue;
        }
        const r = pixels[base], g = pixels[base + 1], b = pixels[base + 2];
        const key = (r << 16) | (g << 8) | b;
        let ci = rgbCache.get(key);
        if (ci === undefined) {
          ci = findClosestIndex(r, g, b, colors, labValues);
          rgbCache.set(key, ci);
        }
        colorIndices[cy * width + cx] = ci;
      }
    }

    results.push({ index, startX, startY, width, height, colorIndices });
  }

  // Transfer Int16Array buffers to avoid copying
  (self as unknown as Worker).postMessage(
    { type: 'MAP_RESULT', chunks: results },
    { transfer: results.map(r => r.colorIndices.buffer) },
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildLabValues(colors: WorkerColor[]): Float32Array {
  const arr = new Float32Array(colors.length * 3);
  for (let i = 0; i < colors.length; i++) {
    const lab = colors[i].lab;
    arr[i * 3] = lab[0];
    arr[i * 3 + 1] = lab[1];
    arr[i * 3 + 2] = lab[2];
  }
  return arr;
}

// ── Entry point ──────────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<IncomingMessage>) => {
  const msg = e.data;
  const pixels = new Uint8ClampedArray(msg.pixels);
  if (msg.type === 'COUNT') {
    handleCount(pixels, msg.colors);
  } else {
    handleMap(pixels, msg.imageWidth, msg.chunks, msg.colors);
  }
};
