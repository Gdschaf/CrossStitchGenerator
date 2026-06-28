import { DMCColor } from '../types';

// Generate letters A-Z
const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)); // A-Z

// Generate numbers 0-9, then 10-99 as strings
const NUMBERS: string[] = [];
for (let i = 0; i < 100; i++) {
  NUMBERS.push(i.toString());
}

// Shape symbols for pattern display - prioritizing letters and numbers for easy identification
export const SHAPE_SYMBOLS = [
  // Start with letters (A-Z) - 26 identifiers
  ...LETTERS,
  // Then numbers (0-99) - 100 identifiers
  ...NUMBERS,
  // Then symbols for additional colors beyond 126
  '●', '■', '▲', '◆', '★', '♦', '♠', '♣', '♥', '☀',
  '☁', '☂', '☃', '☄', '☆', '✿', '✾', '✽', '✼', '✻',
  '✺', '✹', '✸', '✷', '✶', '✵', '✴', '✳', '✲', '✱',
  '✰', '✯', '✮', '✭', '✬', '✫', '✪', '✩', '✧', '✦',
  '✥', '✤', '✣', '✢', '✡', '☸', '☯', '☮', '☭', '☬',
  '☫', '☪', '☩', '☨', '☧', '☦', '☥', '☤', '☣', '☢',
  '☡', '☠', '☟', '☞', '☝', '☜', '☛', '☚', '☙', '☘',
  '☗', '☖', '☕', '☔', '☓', '☒', '☑', '☐', '☏', '☎',
  '☍', '☌', '☋', '☊', '☉', '☈', '☇', '◐', '◑', '◒',
  '◓', '◔', '◕', '◖', '◗', '◘', '◙', '◚', '◛', '◜',
  '◝', '◞', '◟', '◠', '◡', '◢', '◣', '◤', '◥', '◦',
  '◧', '◨', '◩', '◪', '◫', '◬', '◭', '◮', '◯', '◰',
  '◱', '◲', '◳', '◴', '◵', '◶', '◷', '◸', '◹', '◺',
  '◻', '◼', '◽', '◾', '◿', '⬀', '⬁', '⬂', '⬃', '⬄',
  '⬅', '⬆', '⬇', '⬈', '⬉', '⬊', '⬋', '⬌', '⬍', '⬎',
  '⬏', '⬐', '⬑', '⬒', '⬓', '⬔', '⬕', '⬖', '⬗', '⬘',
  '⬙', '⬚', '⬛', '⬜', '⬝', '⬞', '⬟', '⬠', '⬡', '⬢',
  '⬣', '⬤', '⬥', '⬦', '⬧', '⬨', '⬩', '⬪', '⬫', '⬬',
  '⬭', '⬮', '⬯', '⬰', '⬱', '⬲', '⬳', '⬴', '⬵', '⬶',
  '⬷', '⬸', '⬹', '⬺', '⬻', '⬼', '⬽', '⬾', '⬿', '⭀',
  '⭁', '⭂', '⭃', '⭄', '⭅', '⭆', '⭇', '⭈', '⭉', '⭊',
  '⭋', '⭌', '⭍', '⭎', '⭏', '⭐', '⭑', '⭒', '⭓', '⭔',
  '⭕', '⭖', '⭗', '⭘', '⭙', '⭚', '⭛', '⭜', '⭝', '⭞',
  '⭟', '⭠', '⭡', '⭢', '⭣', '⭤', '⭥', '⭦', '⭧', '⭨',
  '⭩', '⭪', '⭫', '⭬', '⭭', '⭮', '⭯', '⭰', '⭱', '⭲',
  '⭳', '⭴', '⭵', '⭶', '⭷', '⭸', '⭹', '⭺', '⭻', '⭼',
  '⭽', '⭾', '⭿', '⮀', '⮁', '⮂', '⮃', '⮄', '⮅', '⮆',
  '⮇', '⮈', '⮉', '⮊', '⮋', '⮌', '⮍', '⮎', '⮏', '⮐',
  '⮑', '⮒', '⮓', '⮔', '⮕', '⮖', '⮗', '⮘', '⮙', '⮚',
  '⮛', '⮜', '⮝', '⮞', '⮟', '⮠', '⮡', '⮢', '⮣', '⮤',
  '⮥', '⮦', '⮧', '⮨', '⮩', '⮪', '⮫', '⮬', '⮭', '⮮',
  '⮯', '⮰', '⮱', '⮲', '⮳', '⮴', '⮵', '⮶', '⮷', '⮸',
  '⮹', '⮺', '⮻', '⮼', '⮽', '⮾', '⮿', '⯀', '⯁', '⯂',
  '⯃', '⯄', '⯅', '⯆', '⯇', '⯈', '⯉', '⯊', '⯋', '⯌',
  '⯍', '⯎', '⯏', '⯐', '⯑', '⯒', '⯓', '⯔', '⯕', '⯖',
  '⯗', '⯘', '⯙', '⯚', '⯛', '⯜', '⯝', '⯞', '⯟', '⯠',
  '⯡', '⯢', '⯣', '⯤', '⯥', '⯦', '⯧', '⯨', '⯩', '⯪',
  '⯫', '⯬', '⯭', '⯮', '⯯', '⯰', '⯱', '⯲', '⯳', '⯴',
  '⯵', '⯶', '⯷', '⯸', '⯹', '⯺', '⯻', '⯼', '⯽', '⯾',
  '⯿'
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
