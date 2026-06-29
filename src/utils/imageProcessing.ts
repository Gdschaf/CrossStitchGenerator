import { Pattern, PatternCell, CropRegion } from '../types';
import { DMCColor } from '../types';
import { findClosestDMCColor, buildLabCache } from './colorMatching';

export async function generatePattern(
  imageFile: File,
  patternWidth: number,
  patternHeight: number,
  dmcColors: DMCColor[],
  signal?: AbortSignal,
  maxColors?: number,
  cropRegion?: CropRegion | null
): Promise<Pattern> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Pattern generation cancelled'));
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(imageFile);

    const handleAbort = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Pattern generation cancelled'));
    };

    if (signal) signal.addEventListener('abort', handleAbort);

    img.onload = async () => {
      if (signal?.aborted) {
        URL.revokeObjectURL(url);
        reject(new Error('Pattern generation cancelled'));
        return;
      }

      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      canvas.width = patternWidth;
      canvas.height = patternHeight;
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
      const data = imageData.data;

      const enabledColors = dmcColors.filter(c => c.enabled !== false);
      let activeColors = enabledColors;

      // ── Pass 1: if maxColors is set, figure out the best N colors ──────────
      if (maxColors && maxColors < enabledColors.length) {
        const labCache1 = buildLabCache(enabledColors);
        const usageCount = new Map<string, number>();
        let processed = 0;

        for (let y = 0; y < patternHeight; y++) {
          if (signal?.aborted) {
            reject(new Error('Pattern generation cancelled'));
            return;
          }
          for (let x = 0; x < patternWidth; x++) {
            const idx = (y * patternWidth + x) * 4;
            if (data[idx + 3] < 128) { processed++; continue; }
            const rgb: [number, number, number] = [data[idx], data[idx + 1], data[idx + 2]];
            const match = findClosestDMCColor(rgb, enabledColors, labCache1);
            if (match) usageCount.set(match.number, (usageCount.get(match.number) ?? 0) + 1);
            processed++;
            if (processed % 1000 === 0) await new Promise(r => setTimeout(r, 0));
          }
        }

        if (signal?.aborted) {
          reject(new Error('Pattern generation cancelled'));
          return;
        }

        const ranked = enabledColors
          .filter(c => usageCount.has(c.number))
          .sort((a, b) => (usageCount.get(b.number) ?? 0) - (usageCount.get(a.number) ?? 0));

        activeColors = ranked.slice(0, maxColors);
      }

      // ── Pass 2 (final): map every pixel to the active color palette ─────────
      const labCache2 = buildLabCache(activeColors);
      const cells: PatternCell[][] = [];
      let processedPixels = 0;

      for (let y = 0; y < patternHeight; y++) {
        if (signal?.aborted) {
          reject(new Error('Pattern generation cancelled'));
          return;
        }
        const row: PatternCell[] = [];
        for (let x = 0; x < patternWidth; x++) {
          const idx = (y * patternWidth + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];

          if (a < 128) {
            row.push({ dmcColor: null, isEmpty: true });
          } else {
            const rgb: [number, number, number] = [r, g, b];
            const closestColor = findClosestDMCColor(rgb, activeColors, labCache2);
            row.push({ dmcColor: closestColor, isEmpty: false });
          }

          processedPixels++;
          if (processedPixels % 1000 === 0) await new Promise(r => setTimeout(r, 0));
        }
        cells.push(row);
      }

      if (signal?.aborted) {
        reject(new Error('Pattern generation cancelled'));
        return;
      }

      if (signal) signal.removeEventListener('abort', handleAbort);

      resolve({ cells, width: patternWidth, height: patternHeight });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      if (signal) signal.removeEventListener('abort', handleAbort);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
