export const fontCatalog = [
  { family: 'Noto Sans', weights: [300, 400, 500, 600, 700] },
  { family: 'Noto Serif', weights: [300, 400, 500, 600, 700] },
  { family: 'Roboto Mono', weights: [300, 400, 500, 600, 700] },
  { family: 'Arimo', weights: [400, 500, 600, 700] },
  { family: 'Tinos', weights: [400, 700] },
  { family: 'Cousine', weights: [400, 700] },
  { family: 'Roboto', weights: [300, 400, 500, 600, 700] },
  { family: 'Open Sans', weights: [300, 400, 500, 600, 700] },
  { family: 'Lato', weights: [300, 400, 700] },
  { family: 'Montserrat', weights: [300, 400, 500, 600, 700] },
  { family: 'Inter', weights: [300, 400, 500, 600, 700] }
] as const;
export type FontFamily = typeof fontCatalog[number]['family'];
export const fontFamilies: FontFamily[] = fontCatalog.map(font => font.family);
export function fontWeights(family: FontFamily): readonly number[] { return fontCatalog.find(font => font.family === family)?.weights || [400, 700]; }
export function effectiveWeight(style: Pick<TextStyle, 'bold' | 'fontWeight'>) { return style.fontWeight ?? (style.bold ? 700 : 400); }
export type Tool = 'select' | 'hand' | 'text' | 'erase' | 'highlight' | 'line';
export interface Rect { x: number; y: number; width: number; height: number }
export interface TextStyle {
  fontFamily: FontFamily;
  fontSize: number; // PDF points in the page's original displayed orientation
  bold: boolean;
  fontWeight?: number;
  italic: boolean;
  color: string;
  letterSpacing: number;
  offsetX?: number; // left glyph bearing / OCR padding, in points
  baseline: number; // offset from top of edit rectangle, in points
}
export interface TextRegion extends Rect {
  id: string;
  text: string;
  style: TextStyle;
  source: 'native' | 'ocr' | 'added';
  confidence: number;
  background: string;
  complexBackground: boolean;
  original?: { rect: Rect; maskRect?: Rect; text: string; style: TextStyle };
  deleted?: boolean;
}
export interface Mark extends Rect {
  id: string;
  type: 'erase' | 'highlight' | 'line' | 'image';
  color: string;
  image?: string;
}
export interface EditorPage {
  id: string;
  source: number;
  index: number;
  width: number;
  height: number;
  baseRotation: number;
  rotation: number;
  deleted: boolean;
  thumbnail: string;
  regions: TextRegion[];
  marks: Mark[];
  analysis: 'pending' | 'native' | 'ocr' | 'mixed';
}
export const id = () => crypto.randomUUID();
export function isChanged(region: TextRegion): boolean {
  const original = region.original;
  return !original || !!region.deleted || region.text !== original.text ||
    ['x', 'y', 'width', 'height'].some(key => region[key] !== original.rect[key]) ||
    Object.keys(region.style).some(key => region.style[key] !== original.style[key]);
}
export function restoreRegion(region: TextRegion): TextRegion {
  return region.original ? { ...region, ...region.original.rect, text: region.original.text,
    style: { ...region.original.style }, deleted: false } : region;
}
export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
export function displaySize(page: Pick<EditorPage, 'width' | 'height' | 'rotation'>) {
  return page.rotation % 180 ? { width: page.height, height: page.width } : { width: page.width, height: page.height };
}
export function unrotatePoint(x: number, y: number, page: Pick<EditorPage, 'width' | 'height' | 'rotation'>) {
  switch (page.rotation % 360) {
    case 90: return { x: y, y: page.height - x };
    case 180: return { x: page.width - x, y: page.height - y };
    case 270: return { x: page.width - y, y: x };
    default: return { x, y };
  }
}
