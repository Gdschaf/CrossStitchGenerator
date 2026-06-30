import { Pattern, PatternCell, CropRegion, DMCColor } from '../types';
import { rgbToLab } from './colorMatching';

const CHUNK_WIDTH = 50;
const CHUNK_HEIGHT = 70;
const MAX_WORKERS = 8;

// ── Types shared with the worker ─────────────────────────────────────────────

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
  colorIndices: Int16Array;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function spawnWorker(): Worker {
  return new Worker(new URL('../workers/patternWorker.ts', import.meta.url), { type: 'module' });
}

function toWorkerColors(colors: DMCColor[]): WorkerColor[] {
  return colors.map(c => ({
    number: c.number,
    name: c.name,
    rgb: c.rgb,
    lab: rgbToLab(c.rgb),
  }));
}

function buildChunks(patternWidth: number, patternHeight: number): ChunkDef[] {
  const chunks: ChunkDef[] = [];
  let index = 0;
  for (let y = 0; y < patternHeight; y += CHUNK_HEIGHT) {
    for (let x = 0; x < patternWidth; x += CHUNK_WIDTH) {
      chunks.push({
        index: index++,
        startX: x,
        startY: y,
        width: Math.min(CHUNK_WIDTH, patternWidth - x),
        height: Math.min(CHUNK_HEIGHT, patternHeight - y),
      });
    }
  }
  return chunks;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

// ── Pass 1: count color usage (single worker, all pixels) ────────────────────

function runCountWorker(
  pixelsBuffer: ArrayBuffer,
  imageWidth: number,
  workerColors: WorkerColor[],
  signal?: AbortSignal,
): Promise<Map<string, number>> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Pattern generation cancelled'));

    const worker = spawnWorker();

    const handleAbort = () => { worker.terminate(); reject(new Error('Pattern generation cancelled')); };
    signal?.addEventListener('abort', handleAbort);

    worker.onmessage = (e) => {
      signal?.removeEventListener('abort', handleAbort);
      worker.terminate();
      resolve(new Map<string, number>(Object.entries(e.data.counts)));
    };
    worker.onerror = (e) => {
      signal?.removeEventListener('abort', handleAbort);
      worker.terminate();
      reject(new Error(e.message));
    };

    // Copy the buffer so Pass 2 can still use the original
    worker.postMessage({ type: 'COUNT', pixels: pixelsBuffer.slice(0), imageWidth, colors: workerColors });
  });
}

// ── Pass 2: map pixels to active colors (N workers, chunked) ─────────────────

function runMapWorkers(
  pixelsBuffer: ArrayBuffer,
  imageWidth: number,
  chunks: ChunkDef[],
  workerColors: WorkerColor[],
  signal?: AbortSignal,
): Promise<ChunkResult[]> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Pattern generation cancelled'));

    const numWorkers = Math.min(
      navigator.hardwareConcurrency ?? 4,
      chunks.length,
      MAX_WORKERS,
    );

    const workers: Worker[] = [];
    const allResults: ChunkResult[] = [];
    let completedWorkers = 0;
    let settled = false;

    const cleanup = () => workers.forEach(w => w.terminate());

    const fail = (msg: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(msg));
    };

    const handleAbort = () => fail('Pattern generation cancelled');
    signal?.addEventListener('abort', handleAbort);

    // Distribute chunks round-robin across workers
    const workerChunks: ChunkDef[][] = Array.from({ length: numWorkers }, () => []);
    chunks.forEach((chunk, i) => workerChunks[i % numWorkers].push(chunk));

    for (let wi = 0; wi < numWorkers; wi++) {
      const worker = spawnWorker();
      workers.push(worker);

      worker.onmessage = (e) => {
        if (settled) return;
        allResults.push(...e.data.chunks);
        completedWorkers++;
        worker.terminate();

        if (completedWorkers === numWorkers) {
          settled = true;
          signal?.removeEventListener('abort', handleAbort);
          allResults.sort((a, b) => a.index - b.index);
          resolve(allResults);
        }
      };

      worker.onerror = (e) => fail(e.message ?? 'Worker error');

      // Each worker gets its own copy of the pixel buffer
      worker.postMessage({
        type: 'MAP',
        pixels: pixelsBuffer.slice(0),
        imageWidth,
        chunks: workerChunks[wi],
        colors: workerColors,
      });
    }
  });
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function generatePattern(
  imageFile: File,
  patternWidth: number,
  patternHeight: number,
  dmcColors: DMCColor[],
  signal?: AbortSignal,
  maxColors?: number,
  cropRegion?: CropRegion | null,
): Promise<Pattern> {
  if (signal?.aborted) throw new Error('Pattern generation cancelled');

  // Draw image to canvas at pattern resolution
  const img = await loadImage(imageFile);
  if (signal?.aborted) throw new Error('Pattern generation cancelled');

  const canvas = document.createElement('canvas');
  canvas.width = patternWidth;
  canvas.height = patternHeight;
  const ctx = canvas.getContext('2d')!;

  if (cropRegion) {
    const cx = Math.round(cropRegion.x * img.width);
    const cy = Math.round(cropRegion.y * img.height);
    const cw = Math.max(1, Math.round(cropRegion.width * img.width));
    const ch = Math.max(1, Math.round(cropRegion.height * img.height));
    ctx.drawImage(img, cx, cy, cw, ch, 0, 0, patternWidth, patternHeight);
  } else {
    ctx.drawImage(img, 0, 0, patternWidth, patternHeight);
  }

  const imageData = ctx.getImageData(0, 0, patternWidth, patternHeight);
  // Slice to get a plain ArrayBuffer we can copy into workers
  const pixelsBuffer = imageData.data.buffer.slice(0);

  const enabledColors = dmcColors.filter(c => c.enabled !== false);

  // ── Pass 1: determine active color palette ────────────────────────────────
  let activeColors = enabledColors;
  if (maxColors && maxColors < enabledColors.length) {
    const workerColors = toWorkerColors(enabledColors);
    const counts = await runCountWorker(pixelsBuffer, patternWidth, workerColors, signal);
    if (signal?.aborted) throw new Error('Pattern generation cancelled');

    const ranked = enabledColors
      .filter(c => counts.has(c.number))
      .sort((a, b) => (counts.get(b.number) ?? 0) - (counts.get(a.number) ?? 0));
    activeColors = ranked.slice(0, maxColors);
  }

  // ── Pass 2: map every pixel to the active palette, in parallel chunks ─────
  const workerColors = toWorkerColors(activeColors);
  const chunks = buildChunks(patternWidth, patternHeight);
  const chunkResults = await runMapWorkers(pixelsBuffer, patternWidth, chunks, workerColors, signal);

  if (signal?.aborted) throw new Error('Pattern generation cancelled');

  // ── Assemble final grid ────────────────────────────────────────────────────
  const cells: PatternCell[][] = Array.from({ length: patternHeight }, () =>
    new Array<PatternCell>(patternWidth),
  );

  for (const { startX, startY, width, height, colorIndices } of chunkResults) {
    for (let cy = 0; cy < height; cy++) {
      for (let cx = 0; cx < width; cx++) {
        const ci = colorIndices[cy * width + cx];
        cells[startY + cy][startX + cx] = ci === -1
          ? { dmcColor: null, isEmpty: true }
          : { dmcColor: activeColors[ci], isEmpty: false };
      }
    }
  }

  return { cells, width: patternWidth, height: patternHeight };
}
