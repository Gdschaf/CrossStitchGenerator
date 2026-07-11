import { DMCColor } from '../types';

// Traditional cross-stitch chart symbols: thin outline/filled shape pairs
// and simple keyboard marks, matching the style used in printed stitch charts.
// The app supports up to 50 colors, so this list covers exactly that.
export const SHAPE_SYMBOLS = [
  '■', '□', '●', '○', '▲', '△', '▼', '▽', '◆', '◇',
  '★', '☆', '♥', '♡', '♣', '♠', '♦', '✕', '✚', '✛',
  '=', '∠', 'Γ', 'm', '7', '<', '>', '°', '▪', '▫',
  '✳', '✱', '◈', '◎', '◉', '▶', '◀', '◁', '▷', '⬟',
  '⬠', '⬢', '⬡', '+', '×', '÷', '~', '^', '•', '∙',
];

/**
 * Creates a mapping from DMC color numbers to shape symbols
 */
export function createShapeMap(colors: DMCColor[]): Map<string, string> {
  const shapeMap = new Map<string, string>();
  colors.forEach((color, index) => {
    const symbol = SHAPE_SYMBOLS[index % SHAPE_SYMBOLS.length];
    shapeMap.set(color.number, symbol);
  });
  return shapeMap;
}

/**
 * Gets the shape symbol for a DMC color
 */
export function getShapeForColor(color: DMCColor | null, shapeMap: Map<string, string>): string {
  if (!color) return '';
  return shapeMap.get(color.number) || '●';
}
