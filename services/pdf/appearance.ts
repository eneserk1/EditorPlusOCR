import { FontFamily, Rect, TextRegion, TextStyle, fontFamilies, fontWeights, effectiveWeight } from './model';
import './fonts.css';

export function canvas(width: number, height: number) {
  const result = document.createElement('canvas');
  result.width = Math.max(1, Math.ceil(width)); result.height = Math.max(1, Math.ceil(height));
  return result;
}
export function cssFont(style: TextStyle, scale = 1) {
  return `${style.italic ? 'italic' : 'normal'} ${effectiveWeight(style)} ${style.fontSize * scale}px "${style.fontFamily}"`;
}
let fontReady: Promise<unknown> | undefined;
export function loadFonts() {
  return fontReady ??= Promise.all(fontFamilies.flatMap(family => fontWeights(family).flatMap(weight =>
    ['normal', 'italic'].map(slant => document.fonts.load(`${slant} ${weight} 16px "${family}"`, 'İıŞşĞğÜüÖöÇçABCabc123')))));
}
function textContext(style: TextStyle) {
  const ctx = canvas(1, 1).getContext('2d')!;
  ctx.font = cssFont(style); ctx.letterSpacing = `${style.letterSpacing}px`;
  return ctx;
}
export function textWidth(text: string, style: TextStyle) {
  const ctx = textContext(style);
  return Math.max(0, style.offsetX || 0) + Math.max(...text.split(/\r?\n/).map(line => {
    const m = ctx.measureText(line); return Math.max(m.width, m.actualBoundingBoxRight);
  }));
}
export function textLayout(region: TextRegion) {
  const ctx = textContext(region.style), lines: string[] = [];
  const maxWidth = Math.max(1, region.width - Math.max(0, region.style.offsetX || 0) - 0.5);
  const fits = (value: string) => { const m = ctx.measureText(value); return Math.max(m.width, m.actualBoundingBoxRight) <= maxWidth; };
  for (const paragraph of region.text.replace(/\r/g, '').split('\n')) {
    let line = '';
    for (const token of paragraph.match(/\s+|\S+/g) || []) {
      if (fits(line + token)) { line += token; continue; }
      if (line.trim()) { lines.push(line.trimEnd()); line = ''; }
      if (fits(token)) { line = token.trimStart(); continue; }
      for (const char of token.trimStart()) {
        if (line && !fits(line + char)) { lines.push(line); line = ''; }
        line += char;
      }
    }
    lines.push(line.trimEnd());
  }
  const metrics = ctx.measureText(region.text.replace(/\s/g, '') || 'Mg');
  return { lines, ascent: metrics.actualBoundingBoxAscent, descent: metrics.actualBoundingBoxDescent,
    lineHeight: Math.max(region.style.fontSize * 1.2, metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent + 1) };
}
export function textOverflow(region: TextRegion) {
  if (region.deleted || !region.text) return false;
  const layout = textLayout(region);
  return layout.lines.some(line => textWidth(line, region.style) > region.width + 0.3) ||
    region.style.baseline - layout.ascent < -0.5 ||
    region.style.baseline + (layout.lines.length - 1) * layout.lineHeight + layout.descent > region.height + 0.5;
}
export function fitTextRegion(region: TextRegion, page: { width: number; height: number }): Partial<TextRegion> {
  if (region.deleted || !region.text) return {};
  const width = Math.min(page.width - region.x, Math.max(region.width, textWidth(region.text, region.style) + 1));
  const layout = textLayout({ ...region, width });
  let y = Math.max(0, region.y - Math.max(0, layout.ascent + 0.5 - region.style.baseline));
  const baseline = region.style.baseline + region.y - y;
  const height = Math.max(region.height + region.y - y, baseline + (layout.lines.length - 1) * layout.lineHeight + layout.descent + 0.5);
  if (height <= page.height && y + height > page.height) y = page.height - height;
  return { y, width, height: Math.min(page.height - y, height), style: { ...region.style, baseline } };
}

function rgb(hex: string) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
function hex(c: number[]) { return '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
function distance(a: number[], b: number[]) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor((sorted.length - 1) * p)] || 0;
}
function medianColor(colors: number[][]) { return [0, 1, 2].map(i => percentile(colors.map(c => c[i]), 0.5)); }
function dominant(colors: number[][]) {
  const buckets = new Map<string, number[][]>();
  for (const c of colors) { const key = c.map(v => Math.round(v / 16)).join(','); const bucket = buckets.get(key) || []; bucket.push(c); buckets.set(key, bucket); }
  const best = [...buckets.values()].sort((a, b) => b.length - a.length)[0];
  return best ? medianColor(best) : [255, 255, 255];
}
export function sampleAppearance(source: HTMLCanvasElement, rect: Rect, scale: number) {
  const ctx = source.getContext('2d', { willReadFrequently: true })!;
  const left = Math.max(0, Math.floor(rect.x * scale - 3)), top = Math.max(0, Math.floor(rect.y * scale - 3));
  const width = Math.max(1, Math.min(source.width - left, Math.ceil(rect.width * scale + 6)));
  const height = Math.max(1, Math.min(source.height - top, Math.ceil(rect.height * scale + 6)));
  const data = ctx.getImageData(left, top, width, height).data;
  const border: number[][] = [], interior: number[][] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4, color = [data[i], data[i + 1], data[i + 2]];
    if (x < 2 || x >= width - 2 || y < 2 || y >= height - 2) border.push(color);
    else if (left + x >= rect.x * scale && left + x < (rect.x + rect.width) * scale &&
      top + y >= rect.y * scale && top + y < (rect.y + rect.height) * scale) interior.push(color);
  }
  const bg = dominant(border), noise = percentile(border.map(c => distance(c, bg)), 0.6);
  const threshold = Math.max(5, Math.min(35, noise * 3 + 3));
  const ink = interior.filter(c => distance(c, bg) > threshold);
  const coreThreshold = percentile(ink.map(c => distance(c, bg)), 0.72);
  const core = ink.filter(c => distance(c, bg) >= coreThreshold);
  return { background: hex(bg), color: hex(core.length ? medianColor(core) : bg),
    complexBackground: border.filter(c => distance(c, bg) > Math.max(20, noise * 3)).length / Math.max(1, border.length) > 0.2 };
}

export function matchingFamily(name: string): FontFamily | undefined {
  const clean = name.replace(/^[A-Z]{6}\+/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  return fontFamilies.find(family => clean.includes(family.replace(/[^a-z0-9]/gi, '').toLowerCase())) ||
    (/arial|helvetica|liberationsans/.test(clean) ? 'Arimo' : /times|liberationserif/.test(clean) ? 'Tinos' :
      /courier|liberationmono/.test(clean) ? 'Cousine' : /monospace/.test(clean) ? 'Roboto Mono' : undefined);
}
type FontHint = { family?: string; size?: number; baseline?: number; bold?: boolean; italic?: boolean; weight?: number };
// Compare soft glyph coverage rather than thresholded black silhouettes: this distinguishes
// light/regular/medium strokes and works with pale or colored ink as well as black text.
export function matchAppearance(source: HTMLCanvasElement, rect: Rect, text: string, scale: number, hint?: FontHint): TextStyle {
  const appearance = sampleAppearance(source, rect, scale), bg = rgb(appearance.background), ink = rgb(appearance.color);
  const sw = Math.max(64, Math.min(180, Math.round(rect.width / rect.height * 44))), sh = 44;
  const target = canvas(sw, sh), targetCtx = target.getContext('2d')!;
  targetCtx.drawImage(source, rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale, 0, 0, sw, sh);
  const pixels = targetCtx.getImageData(0, 0, sw, sh).data;
  const vector = ink.map((c, i) => c - bg[i]), magnitude = Math.max(1, vector.reduce((sum, c) => sum + c * c, 0));
  const targetAlpha = new Float32Array(sw * sh);
  let targetDensity = 0;
  for (let i = 0; i < targetAlpha.length; i++) {
    const projected = vector.reduce((sum, c, channel) => sum + c * (pixels[i * 4 + channel] - bg[channel]), 0) / magnitude;
    targetAlpha[i] = Math.max(0, Math.min(1, projected)); targetDensity += targetAlpha[i];
  }
  targetDensity /= targetAlpha.length;
  const probe = canvas(sw, sh), ctx = probe.getContext('2d')!, metricCtx = canvas(1, 1).getContext('2d')!;
  const preferred = hint?.family ? matchingFamily(hint.family) : undefined;
  const families = preferred ? [preferred] : fontFamilies;
  const results: { style: TextStyle; score: number }[] = [];
  const visited = new Set<string>();
  function evaluate(family: FontFamily, weight: number, italic: boolean) {
    const key = `${family}/${weight}/${italic}`; if (visited.has(key)) return; visited.add(key);
    if (hint?.weight && weight !== [...fontWeights(family)].sort((a, b) => Math.abs(a - hint.weight!) - Math.abs(b - hint.weight!))[0]) return;
    if (hint?.bold === true && weight < 600 || hint?.bold === false && weight >= 600) return;
    if (hint?.italic !== undefined && italic !== hint.italic) return;
    const candidate: TextStyle = { fontFamily: family, fontSize: 100, fontWeight: weight, bold: weight >= 600, italic,
      color: appearance.color, baseline: 0, letterSpacing: 0 };
    metricCtx.font = cssFont(candidate);
    const m = metricCtx.measureText(text), inkH = Math.max(1, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
    const size = hint?.size || rect.height * 100 / inkH, naturalWidth = m.width * size / 100;
    const spacing = text.length > 1 ? Math.max(-size * 0.08, Math.min(size * 0.2, (rect.width - naturalWidth) / text.length)) : 0;
    const baseline = hint?.baseline ?? m.actualBoundingBoxAscent * size / 100;
    candidate.fontSize = Math.max(3, size); candidate.baseline = baseline; candidate.letterSpacing = spacing;
    candidate.offsetX = hint?.baseline !== undefined ? 0 : m.actualBoundingBoxLeft * size / 100;
    ctx.resetTransform(); ctx.clearRect(0, 0, sw, sh); ctx.fillStyle = '#000';
    if (hint?.baseline !== undefined) {
      ctx.scale(sw / rect.width, sh / rect.height); ctx.font = cssFont(candidate); ctx.letterSpacing = `${spacing}px`; ctx.fillText(text, 0, baseline);
    } else {
      const inkW = Math.max(1, m.actualBoundingBoxLeft + m.actualBoundingBoxRight);
      ctx.scale(sw / inkW, sh / inkH); ctx.font = cssFont({ ...candidate, fontSize: 100 }); ctx.letterSpacing = '0px';
      ctx.fillText(text, m.actualBoundingBoxLeft, m.actualBoundingBoxAscent);
    }
    ctx.resetTransform();
    const rendered = ctx.getImageData(0, 0, sw, sh).data;
    let mismatch = 0, density = 0;
    for (let i = 0; i < targetAlpha.length; i++) {
      const alpha = rendered[i * 4 + 3] / 255; mismatch += Math.abs(alpha - targetAlpha[i]); density += alpha;
    }
    density /= targetAlpha.length;
    let score = mismatch / targetAlpha.length + Math.abs(density - targetDensity) * 0.4 + Math.abs(Math.log(Math.max(0.1, naturalWidth / rect.width))) * 0.08;
    if (family === preferred) score -= 0.1;
    if (hint?.weight) score += Math.abs(weight - hint.weight) / 100 * 0.012;
    // An ambiguous noisy scan should not gain heavy strokes without supporting evidence.
    if (!hint?.bold && weight >= 600) score += 0.006;
    results.push({ style: candidate, score });
  }
  for (const family of families) for (const weight of hint?.weight ? [...fontWeights(family)].sort((a, b) => Math.abs(a - hint.weight!) - Math.abs(b - hint.weight!)).slice(0, 1) : [...new Set([fontWeights(family)[0], 400, 700])]) for (const italic of [false, true]) evaluate(family, weight, italic);
  results.sort((a, b) => a.score - b.score);
  const finalists = results.slice(0, 3).map(result => result.style);
  for (const finalist of finalists) for (const weight of fontWeights(finalist.fontFamily)) evaluate(finalist.fontFamily, weight, finalist.italic);
  results.sort((a, b) => a.score - b.score);
  return results[0]?.style || { fontFamily: 'Noto Sans', fontSize: rect.height, bold: false, fontWeight: 400,
    italic: false, color: appearance.color, letterSpacing: 0, baseline: rect.height * 0.85 };
}

export interface Patch { rect: Rect; canvas: HTMLCanvasElement }
export function makePatches(source: HTMLCanvasElement, regions: TextRegion[], scale: number): Patch[] {
  // Always erase at the original location before painting any replacements, including moved words.
  const patches: Patch[] = [];
  for (const region of regions) {
    if (!region.original) continue;
    const r = region.original.maskRect || region.original.rect;
    const patch = canvas(r.width * scale, r.height * scale), ctx = patch.getContext('2d')!;
    ctx.drawImage(source, r.x * scale, r.y * scale, r.width * scale, r.height * scale, 0, 0, patch.width, patch.height);
    // Preserve the rest of the crop: replace only pixels belonging to the detected ink, with a 1px antialias fringe.
    const image = ctx.getImageData(0, 0, patch.width, patch.height);
    const bg = rgb(region.background), ink = rgb(region.original.style.color);
    const mask = new Uint8Array(patch.width * patch.height);
    for (let i = 0; i < mask.length; i++) {
      const c = Array.from(image.data.slice(i * 4, i * 4 + 3));
      const vector = ink.map((v, channel) => v - bg[channel]);
      const magnitude = Math.max(1, vector.reduce((sum, v) => sum + v * v, 0));
      const alpha = vector.reduce((sum, v, channel) => sum + v * (c[channel] - bg[channel]), 0) / magnitude;
      const residual = Math.hypot(...c.map((v, channel) => v - bg[channel] - alpha * vector[channel]));
      if (alpha > 0.012 && distance(c, bg) > 2 && residual < Math.max(10, Math.sqrt(magnitude) * 0.08)) mask[i] = 1;
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
    const layout = textLayout(region);
    layout.lines.forEach((line, index) => ctx.fillText(line, region.style.offsetX || 0, region.style.baseline + index * layout.lineHeight));
    patches.push({ rect: { x: region.x, y: region.y, width: region.width, height: region.height }, canvas: patch });
  }
  return patches;
}
