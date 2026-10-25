import { FontFamily, Rect, TextRegion, TextStyle, fontFamilies } from './model';
import '@fontsource/noto-sans/latin-400.css';
import '@fontsource/noto-sans/latin-ext-400.css';
import '@fontsource/noto-sans/latin-700.css';
import '@fontsource/noto-sans/latin-ext-700.css';
import '@fontsource/noto-sans/latin-400-italic.css';
import '@fontsource/noto-sans/latin-ext-400-italic.css';
import '@fontsource/noto-sans/latin-700-italic.css';
import '@fontsource/noto-sans/latin-ext-700-italic.css';
import '@fontsource/noto-serif/latin-400.css';
import '@fontsource/noto-serif/latin-ext-400.css';
import '@fontsource/noto-serif/latin-700.css';
import '@fontsource/noto-serif/latin-ext-700.css';
import '@fontsource/noto-serif/latin-400-italic.css';
import '@fontsource/noto-serif/latin-ext-400-italic.css';
import '@fontsource/noto-serif/latin-700-italic.css';
import '@fontsource/noto-serif/latin-ext-700-italic.css';
import '@fontsource/roboto-mono/latin-400.css';
import '@fontsource/roboto-mono/latin-ext-400.css';
import '@fontsource/roboto-mono/latin-700.css';
import '@fontsource/roboto-mono/latin-ext-700.css';
import '@fontsource/roboto-mono/latin-400-italic.css';
import '@fontsource/roboto-mono/latin-ext-400-italic.css';
import '@fontsource/roboto-mono/latin-700-italic.css';
import '@fontsource/roboto-mono/latin-ext-700-italic.css';

export function canvas(width: number, height: number) {
  const result = document.createElement('canvas');
  result.width = Math.max(1, Math.ceil(width)); result.height = Math.max(1, Math.ceil(height));
  return result;
}
export function cssFont(style: TextStyle, scale = 1) {
  return `${style.italic ? 'italic' : 'normal'} ${style.bold ? 700 : 400} ${style.fontSize * scale}px "${style.fontFamily}"`;
}
let fontReady: Promise<unknown> | undefined;
export function loadFonts() {
  return fontReady ??= Promise.all(fontFamilies.flatMap(family => [400, 700].flatMap(weight =>
    ['normal', 'italic'].map(slant => document.fonts.load(`${slant} ${weight} 16px "${family}"`, 'İıŞşĞğÜüÖöÇçABCabc123')))));
}
export function textWidth(text: string, style: TextStyle) {
  const ctx = canvas(1, 1).getContext('2d')!;
  ctx.font = cssFont(style);
  ctx.letterSpacing = `${style.letterSpacing}px`;
  return (style.offsetX || 0) + ctx.measureText(text).width;
}
export function textOverflow(region: TextRegion) {
  if (region.deleted || !region.text) return false;
  const ctx = canvas(1, 1).getContext('2d')!;
  ctx.font = cssFont(region.style); ctx.letterSpacing = `${region.style.letterSpacing}px`;
  const metrics = ctx.measureText(region.text);
  return textWidth(region.text, region.style) > region.width + 0.3 || /[\r\n]/.test(region.text) ||
    region.style.baseline - metrics.actualBoundingBoxAscent < -0.5 ||
    region.style.baseline + metrics.actualBoundingBoxDescent > region.height + 0.5;
}
export function fitTextRegion(region: TextRegion, page: { width: number; height: number }): Partial<TextRegion> {
  const ctx = canvas(1, 1).getContext('2d')!;
  ctx.font = cssFont(region.style); ctx.letterSpacing = `${region.style.letterSpacing}px`;
  const metrics = ctx.measureText(region.text);
  const y = Math.max(0, region.y - Math.max(0, metrics.actualBoundingBoxAscent + 0.5 - region.style.baseline));
  const baseline = region.style.baseline + region.y - y;
  return { y, width: Math.min(page.width - region.x, textWidth(region.text, region.style) + 1),
    height: Math.min(page.height - y, Math.max(region.height + region.y - y, baseline + metrics.actualBoundingBoxDescent + 0.5)),
    style: { ...region.style, baseline } };
}

function rgb(hex: string) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
function hex(c: number[]) { return '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); }
function distance(a: number[], b: number[]) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function dominant(colors: number[][]) {
  const buckets = new Map<string, number[][]>();
  for (const c of colors) {
    const k = c.map(v => Math.round(v / 24)).join(',');
    const list = buckets.get(k) || []; list.push(c); buckets.set(k, list);
  }
  const best = [...buckets.values()].sort((a, b) => b.length - a.length)[0];
  return best ? [0, 1, 2].map(i => best.reduce((sum, c) => sum + c[i], 0) / best.length) : [255, 255, 255];
}
export function sampleAppearance(source: HTMLCanvasElement, rect: Rect, scale: number) {
  const ctx = source.getContext('2d', { willReadFrequently: true })!;
  const left = Math.max(0, Math.floor(rect.x * scale - 3));
  const top = Math.max(0, Math.floor(rect.y * scale - 3));
  const width = Math.max(1, Math.min(source.width - left, Math.ceil(rect.width * scale + 6)));
  const height = Math.max(1, Math.min(source.height - top, Math.ceil(rect.height * scale + 6)));
  const data = ctx.getImageData(left, top, width, height).data;
  const border: number[][] = [], interior: number[][] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    const color = [data[i], data[i + 1], data[i + 2]];
    if (x < 2 || x >= width - 2 || y < 2 || y >= height - 2) border.push(color);
    else interior.push(color);
  }
  const bg = dominant(border);
  const ink = interior.filter(c => distance(c, bg) > 65);
  return { background: hex(bg), color: hex(ink.length ? dominant(ink) : [0, 0, 0]),
    complexBackground: border.filter(c => distance(c, bg) > 45).length / border.length > 0.2 };
}

// Fit candidate glyph silhouettes to the original word. Font names in scans are estimates.
export function matchAppearance(source: HTMLCanvasElement, rect: Rect, text: string, scale: number,
  hint?: { family?: string; size?: number; baseline?: number; bold?: boolean; italic?: boolean }): TextStyle {
  const appearance = sampleAppearance(source, rect, scale);
  const sw = 80, sh = 40;
  const target = canvas(sw, sh), targetCtx = target.getContext('2d')!;
  targetCtx.drawImage(source, rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale, 0, 0, sw, sh);
  const pixels = targetCtx.getImageData(0, 0, sw, sh).data;
  const bg = rgb(appearance.background);
  const mask = Array.from({ length: sw * sh }, (_, i) => distance(Array.from(pixels.slice(i * 4, i * 4 + 3)), bg) > 65);
  const probe = canvas(sw, sh), ctx = probe.getContext('2d')!;
  let best = Infinity;
  let result: TextStyle = { fontFamily: 'Noto Sans', fontSize: rect.height, bold: false, italic: false,
    color: appearance.color, letterSpacing: 0, baseline: rect.height * 0.85 };
  const metricCtx = canvas(1, 1).getContext('2d')!;
  for (const family of fontFamilies) for (const bold of [false, true]) for (const italic of [false, true]) {
    if (hint?.bold !== undefined && bold !== hint.bold) continue;
    if (hint?.italic !== undefined && italic !== hint.italic) continue;
    const candidate = { ...result, fontFamily: family, fontSize: 100, bold, italic };
    metricCtx.font = cssFont(candidate);
    const metrics = metricCtx.measureText(text);
    const inkH = Math.max(1, metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent);
    const size = hint?.size || rect.height * 100 / inkH;
    const naturalWidth = metrics.width * size / 100;
    const spacing = text.length > 1 ? Math.max(-size * 0.08, Math.min(size * 0.2, (rect.width - naturalWidth) / (text.length - 1))) : 0;
    const baseline = hint?.baseline ?? metrics.actualBoundingBoxAscent * size / 100;
    candidate.fontSize = size;
    ctx.resetTransform(); ctx.clearRect(0, 0, sw, sh);
    if (hint?.baseline !== undefined) {
      ctx.scale(sw / rect.width, sh / rect.height);
      ctx.font = cssFont(candidate); ctx.letterSpacing = `${spacing}px`; ctx.fillStyle = '#000';
      ctx.fillText(text, 0, baseline);
    } else {
      // OCR boxes enclose ink, not a font's advance box. Compare ink silhouettes
      // independently of margins so commas/short numbers do not suggest a false style.
      const inkW = Math.max(1, metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight);
      ctx.scale(sw / inkW, sh / inkH);
      ctx.font = cssFont({ ...candidate, fontSize: 100 }); ctx.letterSpacing = '0px'; ctx.fillStyle = '#000';
      ctx.fillText(text, metrics.actualBoundingBoxLeft, metrics.actualBoundingBoxAscent);
    }
    ctx.resetTransform();
    const candidateData = ctx.getImageData(0, 0, sw, sh).data;
    let mismatch = 0;
    for (let i = 0; i < mask.length; i++) if (mask[i] !== (candidateData[i * 4 + 3] > 80)) mismatch++;
    let score = mismatch / mask.length + Math.abs(Math.log(Math.max(0.1, naturalWidth / rect.width))) * 0.2;
    const name = hint?.family?.toLowerCase() || '';
    if ((/times|serif/.test(name) && !/sans/.test(name) && family === 'Noto Serif') || (/courier|mono/.test(name) && family === 'Roboto Mono') ||
      (/arial|helvetica|sans/.test(name) && family === 'Noto Sans')) score -= 0.08;
    if (score < best) {
      best = score;
      result = { ...candidate, fontSize: Math.max(3, size), color: appearance.color, baseline, letterSpacing: spacing, offsetX: hint?.baseline !== undefined ? 0 : metrics.actualBoundingBoxLeft * size / 100 };
    }
  }
  return result;
}

export interface Patch { rect: Rect; canvas: HTMLCanvasElement }
export function makePatches(source: HTMLCanvasElement, regions: TextRegion[], scale: number): Patch[] {
  // Always erase at the original location before painting any replacements, including moved words.
  const patches: Patch[] = [];
  for (const region of regions) {
    if (!region.original) continue;
    const r = region.original.rect;
    const patch = canvas(r.width * scale, r.height * scale), ctx = patch.getContext('2d')!;
    ctx.drawImage(source, r.x * scale, r.y * scale, r.width * scale, r.height * scale, 0, 0, patch.width, patch.height);
    // Preserve the rest of the crop: replace only pixels belonging to the detected ink, with a 1px antialias fringe.
    const image = ctx.getImageData(0, 0, patch.width, patch.height);
    const bg = rgb(region.background), ink = rgb(region.original.style.color);
    const mask = new Uint8Array(patch.width * patch.height);
    for (let i = 0; i < mask.length; i++) {
      const c = Array.from(image.data.slice(i * 4, i * 4 + 3));
      if (distance(c, bg) > 28 && distance(c, ink) < distance(c, bg) * 1.5) mask[i] = 1;
    }
    // Keep long table rules crossing a word crop.
    for (let y = 0; y < patch.height; y++) {
      let count = 0;
      for (let x = 0; x < patch.width; x++) count += mask[y * patch.width + x];
      if (count > patch.width * 0.9 && patch.width > patch.height * 2) mask.fill(0, y * patch.width, (y + 1) * patch.width);
    }
    const original = new Uint8Array(mask);
    for (let y = 0; y < patch.height; y++) for (let x = 0; x < patch.width; x++) {
      if (!original[y * patch.width + x]) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < patch.width && ny < patch.height) mask[ny * patch.width + nx] = 1;
      }
    }
    for (let i = 0; i < mask.length; i++) if (mask[i]) {
      image.data[i * 4] = bg[0]; image.data[i * 4 + 1] = bg[1]; image.data[i * 4 + 2] = bg[2]; image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    patches.push({ rect: { ...r }, canvas: patch });
  }
  for (const region of regions) {
    if (region.deleted || !region.text) continue;
    const patch = canvas(region.width * scale, region.height * scale), ctx = patch.getContext('2d')!;
    ctx.scale(scale, scale); ctx.font = cssFont(region.style); ctx.fillStyle = region.style.color;
    ctx.letterSpacing = `${region.style.letterSpacing}px`;
    ctx.fillText(region.text, region.style.offsetX || 0, region.style.baseline);
    patches.push({ rect: { x: region.x, y: region.y, width: region.width, height: region.height }, canvas: patch });
  }
  return patches;
}
