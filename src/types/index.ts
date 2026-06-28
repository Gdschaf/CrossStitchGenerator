export interface DMCColor {
  number: string;
  name: string;
  rgb: [number, number, number];
  enabled?: boolean;
}

export interface PatternCell {
  dmcColor: DMCColor | null;
  isEmpty: boolean;
}

export interface Pattern {
  cells: PatternCell[][];
  width: number;
  height: number;
}

// Normalized 0–1 crop region relative to the original image dimensions
export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}
