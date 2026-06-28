import { DMCColor } from '../types';

// Convert sRGB [0–255] to CIE XYZ (D65 illuminant)
function rgbToXyz(rgb: [number, number, number]): [number, number, number] {
  let r = rgb[0] / 255;
  let g = rgb[1] / 255;
  let b = rgb[2] / 255;

  // Linearize (sRGB gamma removal)
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // D65 matrix
  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
  const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;

  return [x, y, z];
}

// Convert CIE XYZ to CIE L*a*b* (D65 reference white)
function xyzToLab(xyz: [number, number, number]): [number, number, number] {
  // D65 reference white
  let x = xyz[0] / 0.95047;
  let y = xyz[1] / 1.00000;
  let z = xyz[2] / 1.08883;

  const f = (t: number) =>
    t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;

  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bStar = 200 * (fy - fz);

  return [L, a, bStar];
}

export function rgbToLab(rgb: [number, number, number]): [number, number, number] {
  return xyzToLab(rgbToXyz(rgb));
}

// CIE76 Delta-E between two L*a*b* values
function deltaE(lab1: [number, number, number], lab2: [number, number, number]): number {
  const dL = lab1[0] - lab2[0];
  const da = lab1[1] - lab2[1];
  const db = lab1[2] - lab2[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

// Find the closest DMC color using CIE76 Delta-E.
// Pass a pre-built labCache (Map<DMC number, LAB>) to avoid recomputing
// LAB values for the palette on every pixel — build it once per generation run.
export function findClosestDMCColor(
  rgb: [number, number, number],
  dmcColors: DMCColor[],
  labCache?: Map<string, [number, number, number]>
): DMCColor | null {
  if (dmcColors.length === 0) return null;

  const pixelLab = rgbToLab(rgb);

  let closestColor = dmcColors[0];
  const firstLab = labCache?.get(dmcColors[0].number) ?? rgbToLab(dmcColors[0].rgb);
  let minDist = deltaE(pixelLab, firstLab);

  for (let i = 1; i < dmcColors.length; i++) {
    const color = dmcColors[i];
    const lab = labCache?.get(color.number) ?? rgbToLab(color.rgb);
    const dist = deltaE(pixelLab, lab);
    if (dist < minDist) {
      minDist = dist;
      closestColor = color;
    }
  }

  return closestColor;
}

// Build a LAB cache for a set of DMC colors. Call once before a generation
// run and pass the result to findClosestDMCColor to avoid recomputing.
export function buildLabCache(dmcColors: DMCColor[]): Map<string, [number, number, number]> {
  const cache = new Map<string, [number, number, number]>();
  for (const color of dmcColors) {
    cache.set(color.number, rgbToLab(color.rgb));
  }
  return cache;
}
