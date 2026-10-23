import { Annotation, PdfPage } from '../types';

export const textChanged = (ann: Annotation) => {
  if (!ann.original) return true;
  if (ann.isDeleted) return true;
  return Object.keys(ann.original).some(key =>
    (ann as any)[key] !== (ann.original as any)[key]);
};

export function originalMaskBounds(ann: Annotation, width: number, height: number) {
  const box = ann.original!;
  const padding = ann.maskPadding ?? 1.5;
  const angle = (box.rotation || 0) * Math.PI / 180;
  return {
    ...box,
    x: box.x - padding * (Math.cos(angle) - Math.sin(angle)) / width * 100,
    y: box.y - padding * (Math.sin(angle) + Math.cos(angle)) / height * 100,
    width: box.width + padding * 2 / width * 100,
    height: box.height + padding * 2 / height * 100,
  };
}

const remember = (ann: Annotation): Annotation => ({
  ...ann,
  originalContent: ann.content,
  original: {
    x: ann.x, y: ann.y, width: ann.width, height: ann.height,
    content: ann.content || '', fontSize: ann.fontSize, fontFamily: ann.fontFamily,
    isBold: ann.isBold, isItalic: ann.isItalic, color: ann.color,
    rotation: ann.rotation, baseline: ann.baseline,
    backgroundColor: ann.backgroundColor, textBackgroundColor: ann.textBackgroundColor,
    opacity: ann.opacity,
  },
});

const familyFor = (name: string): Annotation['fontFamily'] =>
  /mono|courier|console/i.test(name) ? 'Courier' :
  /serif|times|georgia|cambria/i.test(name) && !/sans/i.test(name) ? 'Times New Roman' : 'Helvetica';

type SourceFont = { font: any; glyphs: Map<string, any>; widths: Map<string, number>; tokens: string[] };
const sourceFonts = new Map<string, SourceFont>();
let sourceFontId = 0;

function retainSourceFont(info: any) {
  if (!info?.data || !info.toUnicode || !(window as any).fontkit) return undefined;
  try {
    const bytes = new Uint8Array(info.data);
    const font = (window as any).fontkit.create(bytes);
    const glyphs = new Map<string, any>();
    const widths = new Map<string, number>();
    const ambiguous = new Set<string>();
    const map = info.toUnicode._map;
    const add = (code: number, unicode: unknown) => {
      if (typeof unicode !== 'string' || !unicode || /[\r\n]/.test(unicode)) return;
      if (Number.isFinite(info.widths?.[code])) widths.set(unicode, info.widths[code] / 1000);
      const mapped = info.toFontChar?.[code];
      if (!Number.isInteger(mapped)) return;
      const glyph = font.glyphForCodePoint(mapped);
      if (glyphs.has(unicode) && glyphs.get(unicode).id !== glyph.id) {
        glyphs.delete(unicode);
        ambiguous.add(unicode);
      }
      if (ambiguous.has(unicode)) return;
      if (glyph.id && !glyphs.has(unicode)) {
        glyphs.set(unicode, glyph);
      }
    };
    // Serialized PDF.js maps are sparse arrays/objects, not necessarily cmap
    // Unicode keys. Resolve PDF code -> Unicode and PDF code -> browser cmap.
    if (map) Object.keys(map).forEach(code => add(Number(code), map[code]));
    else if (typeof info.toUnicode.forEach === 'function') {
      info.toUnicode.forEach((code: number, unicode: unknown) => add(code, typeof unicode === 'number' ? String.fromCodePoint(unicode) : unicode));
    } else if (Number.isInteger(info.toUnicode.firstChar) && Number.isInteger(info.toUnicode.lastChar)) {
      Object.keys(info.toFontChar || {}).forEach(key => {
        const code = Number(key);
        if (code >= info.toUnicode.firstChar && code <= info.toUnicode.lastChar && code <= 0x10ffff) add(code, String.fromCodePoint(code));
      });
    }
    if (!glyphs.size) return undefined;
    const name = `EditorSource${sourceFontId++}`;
    sourceFonts.set(name, { font, glyphs, widths, tokens: [...glyphs.keys()].sort((a, b) => b.length - a.length) });
    return name;
  } catch { return undefined; }
}

async function nativeRuns(page: any) {
  const { OPS } = (window as any).pdfjsLib;
  const operators = await page.getOperatorList();
  const runs: { font: string; glyphs: { text: string; advance: number }[]; charSpacing: number; wordSpacing: number; size: number; fillColor?: string }[] = [];
  let state = { font: '', size: 1, charSpacing: 0, wordSpacing: 0, fillColor: '#000000' as string | undefined, fillOpacity: 1, renderingMode: 0 };
  const stack: typeof state[] = [];
  operators.fnArray.forEach((op: number, i: number) => {
    const args = operators.argsArray[i];
    if (op === OPS.save || op === OPS.paintFormXObjectBegin) stack.push({ ...state });
    else if (op === OPS.restore || op === OPS.paintFormXObjectEnd) state = stack.pop() || state;
    else if (op === OPS.setFont) { state.font = args[0]; state.size = Math.abs(args[1]) || 1; }
    else if (op === OPS.setCharSpacing) state.charSpacing = args[0];
    else if (op === OPS.setWordSpacing) state.wordSpacing = args[0];
    else if (op === OPS.setFillRGBColor) {
      state.fillColor = args.length === 3 ? '#' + Array.from(args as ArrayLike<number>, value =>
        Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('') : undefined;
    } else if (op === OPS.setFillColorN || op === OPS.setFillColor || op === OPS.setFillCMYKColor || op === OPS.setFillGray) {
      state.fillColor = undefined;
    } else if (op === OPS.setTextRenderingMode) state.renderingMode = args[0];
    else if (op === OPS.setGState) {
      for (const [key, value] of args[0]) if (key === 'ca') state.fillOpacity = value;
    }
    else if (op === OPS.showText || op === OPS.showSpacedText || op === OPS.nextLineShowText || op === OPS.nextLineSetSpacingShowText) {
      if (op === OPS.nextLineSetSpacingShowText) { state.wordSpacing = args[0]; state.charSpacing = args[1]; }
      const values = args[args.length - 1];
      if (!Array.isArray(values)) return;
      const glyphs: { text: string; advance: number }[] = [];
      for (const value of values) {
        if (typeof value === 'number') {
          if (glyphs.length) glyphs[glyphs.length - 1].advance -= value / 1000;
        } else if (typeof value?.unicode === 'string') {
          glyphs.push({ text: value.unicode, advance: value.width / 1000 +
            state.charSpacing / state.size + (value.isSpace ? state.wordSpacing / state.size : 0) });
        }
      }
      runs.push({ ...state, glyphs, fillColor: state.fillOpacity === 1 && state.renderingMode === 0 ? state.fillColor : undefined });
    }
  });
  return runs;
}

function glyphHeight(canvas: HTMLCanvasElement, x: number, y: number, width: number, height: number, background: string) {
  const ctx = canvas.getContext('2d');
  const left = Math.max(0, Math.floor(x)), top = Math.max(0, Math.floor(y));
  const w = Math.min(canvas.width - left, Math.ceil(width)), h = Math.min(canvas.height - top, Math.ceil(height));
  if (!ctx || w <= 0 || h <= 0) return undefined;
  const bg = [1, 3, 5].map(i => parseInt(background.slice(i, i + 2), 16));
  const pixels = ctx.getImageData(left, top, w, h).data;
  let first = h, last = -1;
  for (let row = 0; row < h; row++) {
    let ink = 0;
    for (let col = 0; col < w; col++) {
      const i = (row * w + col) * 4;
      if (bg.reduce((sum, value, k) => sum + (pixels[i + k] - value) ** 2, 0) > 6000) ink++;
    }
    if (ink >= Math.max(1, w * 0.005)) { first = Math.min(first, row); last = row; }
  }
  return last >= first ? last - first + 1 : undefined;
}

export function sampleColors(canvas: HTMLCanvasElement, x: number, y: number, w: number, h: number) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { color: '#000000', maskColor: '#ffffff' };
  const left = Math.max(0, Math.floor(x - 2)), top = Math.max(0, Math.floor(y - 2));
  const width = Math.min(canvas.width - left, Math.ceil(w + 4));
  const height = Math.min(canvas.height - top, Math.ceil(h + 4));
  if (width <= 0 || height <= 0) return { color: '#000000', maskColor: '#ffffff' };
  const pixels = ctx.getImageData(left, top, width, height).data;
  const buckets = new Map<string, { count: number; sum: number[] }>();
  for (let i = 0; i < pixels.length; i += 4) {
    const key = [0, 1, 2].map(k => Math.min(255, Math.round(pixels[i + k] / 16) * 16)).join(',');
    const bucket = buckets.get(key) || { count: 0, sum: [0, 0, 0] };
    bucket.count++;
    for (let k = 0; k < 3; k++) bucket.sum[k] += pixels[i + k];
    buckets.set(key, bucket);
  }
  // Buckets identify robust color clusters; output uses their actual pixels,
  // not the quantized bucket centers.
  const average = (bucket: { count: number; sum: number[] }) => bucket.sum.map(value => Math.round(value / bucket.count));
  const background = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  const bg = background ? average(background) : [255, 255, 255];
  let fg = bg, best = 0;
  for (const bucket of buckets.values()) {
    if (bucket.count < Math.max(2, width * height * 0.005)) continue;
    const rgb = average(bucket);
    const distance = rgb.reduce((sum, value, i) => sum + (value - bg[i]) ** 2, 0);
    if (distance > best) { best = distance; fg = rgb; }
  }
  const hex = (rgb: number[]) => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
  return { color: hex(fg), maskColor: hex(bg) };
}

export async function extractNativeText(page: any, viewport: any, canvas: HTMLCanvasElement): Promise<Annotation[]> {
  const content = await page.getTextContent();
  const pdfjs = (window as any).pdfjsLib;
  const retained = new Map<string, string | undefined>();
  const runs = await nativeRuns(page);
  let runCursor = 0;
  return content.items.filter((item: any) => item.str?.trim()).map((item: any, index: number) => {
    const style = content.styles[item.fontName] || {};
    const tx = pdfjs.Util.transform(viewport.transform, item.transform);
    let angle = Math.atan2(tx[1], tx[0]);
    if (style.vertical) angle += Math.PI / 2;
    const size = Math.hypot(tx[2], tx[3]);
    const ascent = size * (style.ascent ?? (style.descent ? 1 + style.descent : 0.8));
    const x = tx[4] + ascent * Math.sin(angle);
    const y = tx[5] - ascent * Math.cos(angle);
    let fontInfo: any;
    try { fontInfo = page.commonObjs.get(item.fontName); } catch { /* Some PDFs do not expose font metadata. */ }
    const name = `${fontInfo?.name || item.fontName} ${style.fontFamily || ''}`;
    const width = Math.max(1, item.width * viewport.scale);
    const height = Math.max(1, size, ascent - size * (style.descent ?? -0.2));
    const corners = [[0, 0], [width, 0], [0, height], [width, height]].map(([dx, dy]) => [
      x + dx * Math.cos(angle) - dy * Math.sin(angle),
      y + dx * Math.sin(angle) + dy * Math.cos(angle),
    ]);
    const left = Math.min(...corners.map(point => point[0])), top = Math.min(...corners.map(point => point[1]));
    const boxWidth = Math.max(...corners.map(point => point[0])) - left;
    const boxHeight = Math.max(...corners.map(point => point[1])) - top;
    const colors = sampleColors(canvas, left, top, boxWidth, boxHeight);
    if (!retained.has(item.fontName)) retained.set(item.fontName, retainSourceFont(fontInfo));
    let sourceSpacing: Annotation['sourceSpacing'];
    // Only accept unambiguous operator/text-item alignment. Synthetic spaces,
    // bidi reordering and vertical writing fall back to measured native width.
    if (!style.vertical && item.dir !== 'rtl') {
      for (let r = runCursor; r < runs.length; r++) {
        const run = runs[r];
        if (run.font !== item.fontName) continue;
        let glyphs = [...run.glyphs], end = r;
        while (glyphs.map(g => g.text).join('').length < item.str.length && runs[end + 1]?.font === run.font) {
          glyphs = glyphs.concat(runs[++end].glyphs);
        }
        if (glyphs.map(g => g.text).join('') !== item.str) continue;
        if (run.fillColor && runs.slice(r, end + 1).every(part => part.fillColor === run.fillColor)) colors.color = run.fillColor;
        const total = glyphs.reduce((sum, glyph) => sum + glyph.advance, 0);
        if (total > 0) sourceSpacing = {
          horizontalScale: Math.hypot(tx[0], tx[1]) / size,
          charSpacing: run.charSpacing / run.size, wordSpacing: run.wordSpacing / run.size, glyphs,
        };
        runCursor = end + 1;
        break;
      }
    }
    return remember({
      id: `native-${index}`, type: 'text', source: 'native', content: item.str,
      x: x / canvas.width * 100, y: y / canvas.height * 100,
      width: width / canvas.width * 100, height: height / canvas.height * 100,
      fontSize: size, baseline: ascent, rotation: angle * 180 / Math.PI,
      maskPadding: Math.max(1.5, size * 0.1),
      fontFamily: familyFor(name), detectedFont: name,
      sourceFont: !style.vertical && item.dir !== 'rtl' ? retained.get(item.fontName) : undefined,
      sourceSpacing,
      sourceGlyphHeight: Math.abs(angle) < 0.01 ? glyphHeight(canvas, left, top, boxWidth, boxHeight, colors.maskColor) : undefined,
      isBold: !!fontInfo?.bold || /bold|black|heavy|demi/i.test(name),
      isItalic: !!fontInfo?.italic || /italic|oblique/i.test(name),
      detectedBounds: {
        x: left / canvas.width * 100, y: top / canvas.height * 100,
        width: boxWidth / canvas.width * 100, height: boxHeight / canvas.height * 100,
      },
      isInteractive: true, ...colors,
    });
  });
}

export function ocrAnnotations(data: any, canvas: HTMLCanvasElement): Annotation[] {
  const words = data.words?.length ? data.words : (data.lines || []).flatMap((line: any) => line.words || [line]);
  return words.filter((word: any) => word.text?.trim() && word.bbox).map((word: any, index: number) => {
    const { x0, y0, x1, y1 } = word.bbox;
    const height = Math.max(1, y1 - y0);
    // Keep OCR's nominal size hint; replacement metrics are calibrated to its pixel bbox.
    const size = Number(word.font_size) > 0 ? Number(word.font_size) : height / 0.75;
    const name = word.font_name || '';
    return remember({
      id: `ocr-${index}`, type: 'text', source: 'ocr', content: word.text.trim(),
      x: x0 / canvas.width * 100, y: y0 / canvas.height * 100,
      width: (x1 - x0) / canvas.width * 100, height: height / canvas.height * 100,
      fontSize: size, baseline: height, rotation: 0, fontFamily: familyFor(name),
      sourceGlyphHeight: height,
      detectedFont: name || 'Tahmini', confidence: word.confidence,
      isBold: !!word.is_bold, isItalic: !!word.is_italic, isInteractive: true,
      ...sampleColors(canvas, x0, y0, x1 - x0, height),
    });
  });
}

export function overlapsOriginal(a: Annotation, b: Annotation) {
  const aa = a.detectedBounds || a.original || a, bb = b.detectedBounds || b.original || b;
  const area = Math.max(0, Math.min(aa.x + aa.width, bb.x + bb.width) - Math.max(aa.x, bb.x)) *
    Math.max(0, Math.min(aa.y + aa.height, bb.y + bb.height) - Math.max(aa.y, bb.y));
  return area > Math.min(aa.width * aa.height, bb.width * bb.height) * 0.35;
}

const fontBytes = new Map<string, Promise<ArrayBuffer>>();
const browserFonts = new Map<string, Promise<void>>();
export const editingFontName = (ann: Annotation) => {
  if (usesSourceOutlines(ann)) return ann.sourceFont!;
  return `Editor${ann.fontFamily === 'Courier' ? 'Mono' : ann.fontFamily === 'Times New Roman' ? 'Serif' : 'Sans'}${ann.isBold ? 'Bold' : ''}${ann.isItalic ? 'Italic' : ''}`;
};

const fallbackAnnotation = (ann: Annotation): Annotation => ({ ...ann, sourceFont: undefined });
const fallbackFonts = new Map<string, any>();
// These scripts/direction controls require bidi and contextual shaping, not a
// left-to-right sequence of independently positioned source glyphs.
const needsBidiShaping = /[\u0590-\u08ff\u200e-\u200f\u202a-\u202e\u2066-\u2069\ufb1d-\ufdff\ufe70-\ufeff\u{10800}-\u{10fff}\u{1e800}-\u{1eeff}]/u;
export const usesSourceOutlines = (ann: Annotation) => !!(
  ann.sourceFont && sourceFonts.has(ann.sourceFont) && !needsBidiShaping.test(ann.content || '')
);

export const textFontStyle = (ann: Annotation) =>
  !editingFontName(ann).startsWith('EditorSource') && ann.fontFamily === 'Courier' && ann.isItalic ? 'italic' : 'normal';

let measuringCanvas: HTMLCanvasElement | undefined;
function outlineLayout(ann: Annotation) {
  const source = usesSourceOutlines(ann) ? sourceFonts.get(ann.sourceFont!) : undefined;
  if (!source) return undefined;
  const fallback = fallbackFonts.get(editingFontName(fallbackAnnotation(ann)));
  const glyphs: { text: string; path: string; x: number; y: number; scale: number; advance: number; start: number; end: number; source: boolean }[] = [];
  const carets: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  const size = ann.fontSize || 24;
  let x = 0, y = 0, index = 0, maxWidth = 0;
  const content = ann.content || '';
  const spacing = ann.useSourceMetrics !== false ? ann.sourceSpacing : undefined;
  while (index < content.length) {
    if (content[index] === '\r' || content[index] === '\n') {
      if (content[index] === '\n') { maxWidth = Math.max(maxWidth, x); x = 0; y += size * 1.2; }
      carets[++index] = { x, y };
      continue;
    }
    const token = source.tokens.find(text => content.startsWith(text, index));
    const text = token || String.fromCodePoint(content.codePointAt(index)!);
    const font = token ? source.font : fallback;
    const glyph = token ? source.glyphs.get(token) : font?.glyphForCodePoint(text.codePointAt(0));
    const scale = size / (font?.unitsPerEm || 1000);
    let advance = (glyph?.advanceWidth ?? (text === ' ' ? 250 : 600)) * scale;
    if (spacing) {
      if (source.widths.has(text)) advance = source.widths.get(text)! * size;
      advance += size * (spacing.charSpacing + (text === ' ' ? spacing.wordSpacing : 0));
      // Preserve occurrence-specific TJ kerning when its adjacent text survives.
      let offset = 0;
      for (let i = 0; i < spacing.glyphs.length; i++) {
        const original = spacing.glyphs[i], next = spacing.glyphs[i + 1];
        if (offset === index && original.text === text && (!next || content.startsWith(next.text, index + text.length))) {
          advance = original.advance * size; break;
        }
        offset += original.text.length;
      }
    }
    glyphs.push({ text, path: glyph?.path.toSVG() || '', x, y, scale, advance, start: index, end: index + text.length, source: !!token });
    for (let n = 1; n <= text.length; n++) carets[index + n] = { x: x + advance * n / text.length, y };
    index += text.length;
    x += advance;
  }
  return { glyphs, carets, inkWidth: Math.max(maxWidth, x) };
}

export function textLayout(ann: Annotation, page: Pick<PdfPage, 'previewWidth' | 'previewHeight'>) {
  measuringCanvas ||= document.createElement('canvas');
  const context = measuringCanvas.getContext('2d');
  const nominalSize = ann.fontSize || 24;
  const outlines = outlineLayout(ann);
  let size = nominalSize, scaleX = ann.textStyle?.width ?? 1;
  const reference = ann.original && ann.useSourceMetrics !== false ? { ...ann, content: ann.original.content } : ann;
  const measure = (text: string, source = false) => {
    if (!context) return undefined;
    const font = outlines ? (source ? reference : ann) : fallbackAnnotation(source ? reference : ann);
    context.font = `${textFontStyle(font)} ${size}px "${editingFontName(font)}"`;
    return context.measureText(text);
  };
  if (ann.textStyle) size *= ann.textStyle.height;
  else if (!outlines && ann.original && ann.useSourceMetrics !== false) {
    const referenceSize = ann.original.fontSize || nominalSize;
    size = referenceSize;
    const metrics = measure(ann.original.content, true);
    const inkHeight = metrics && metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    if (ann.source === 'ocr' && inkHeight && ann.sourceGlyphHeight) size *= ann.sourceGlyphHeight / inkHeight;
    const width = measure(ann.original.content, true)?.width;
    if (width) scaleX = ann.original.width / 100 * (page.previewWidth || 1) / width;
    size *= nominalSize / referenceSize;
  }
  if (outlines) {
    size = nominalSize;
    const referenceSize = ann.original?.fontSize || nominalSize;
    const referenceWidth = ann.original?.width ?? ann.width;
    const original = outlineLayout({ ...ann, content: ann.original?.content || ann.content, fontSize: referenceSize });
    scaleX = ann.sourceSpacing?.horizontalScale ?? ann.textStyle?.width ??
      (ann.original && original?.inkWidth ? referenceWidth / 100 * (page.previewWidth || 1) / original.inkWidth : 1);
  }
  const metrics = measure('Mg');
  const ascent = metrics?.fontBoundingBoxAscent ?? size * 0.8;
  const descent = metrics?.fontBoundingBoxDescent ?? size * 0.2;
  const sourceMetrics = measure(ann.original?.content || ann.content || 'Mg', true);
  const baseline = ann.source === 'ocr' && ann.useSourceMetrics !== false && ann.original
    ? sourceMetrics?.actualBoundingBoxAscent ?? size * 0.8
    : (ann.baseline ?? size * 0.8);
  const lines = (ann.content || '').replace(/\r/g, '').split('\n');
  const width = (outlines?.inkWidth ?? Math.max(1, ...lines.map(line => measure(line)?.width || 0))) * scaleX;
  const browserBaseline = (size * 1.2 - ascent - descent) / 2 + ascent;
  return {
    size, scaleX, baseline, baselineOffset: baseline - browserBaseline,
    width: Math.max(ann.width / 100 * (page.previewWidth || 1), width + size),
    height: Math.max(ann.height / 100 * (page.previewHeight || 1), baseline + (lines.length - 1) * size * 1.2 + descent + size * 0.6),
    calibration: { width: scaleX, height: size / nominalSize },
    outlines,
  };
}

function loadFontBytes(ann: Annotation) {
  const family = ann.fontFamily === 'Courier' ? 'NotoSansMono' : ann.fontFamily === 'Times New Roman' ? 'NotoSerif' : 'NotoSans';
  // Noto Mono has no italic file; both the preview and PDF synthesize its slant.
  const variant = `${ann.isBold ? 'Bold' : ''}${ann.isItalic && family !== 'NotoSansMono' ? 'Italic' : ''}` || 'Regular';
  const url = `https://raw.githubusercontent.com/notofonts/noto-fonts/ffebf8c1ee449e544955a7e813c54f9b73848eac/hinted/ttf/${family}/${family}-${variant}.ttf`;
  if (!fontBytes.has(url)) fontBytes.set(url, fetch(url, { signal: AbortSignal.timeout(30000) }).then(async response => {
    if (!response.ok) throw new Error('Türkçe yazı tipi indirilemedi. İnternet bağlantınızı kontrol edin.');
    return response.arrayBuffer();
  }).catch(error => {
    fontBytes.delete(url);
    throw new Error('Türkçe yazı tipi indirilemedi. İnternet bağlantınızı kontrol edin; özgün metin değiştirilmedi.', { cause: error });
  }));
  return fontBytes.get(url)!;
}

export function prepareBrowserFont(ann: Annotation) {
  const fallback = fallbackAnnotation(ann);
  const name = editingFontName(fallback);
  if (!browserFonts.has(name)) browserFonts.set(name, (async () => {
    const bytes = await loadFontBytes(fallback);
    if ((window as any).fontkit) fallbackFonts.set(name, (window as any).fontkit.create(new Uint8Array(bytes)));
    const face = new FontFace(name, bytes);
    document.fonts.add(await face.load());
  })().catch(error => { browserFonts.delete(name); throw error; }));
  return browserFonts.get(name)!;
}

export async function drawPageEdits(doc: any, page: any, model: PdfPage, fonts: Map<string, any>) {
  const lib = (window as any).PDFLib;
  const { rgb, degrees, pushGraphicsState, popGraphicsState, concatTransformationMatrix } = lib;
  const width = model.displayWidth || page.getWidth(), height = model.displayHeight || page.getHeight();
  const sx = width / (model.previewWidth || width * 2);
  const sy = height / (model.previewHeight || height * 2);
  const color = (value = '#000000') => rgb(...[1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16) / 255));
  const [a, b, c, d, e, f] = model.viewportTransform || [1, 0, 0, -1, 0, height];
  const det = a * d - b * c;
  const inverse = [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(
    inverse[0], inverse[1], -inverse[2], -inverse[3],
    inverse[2] * height + inverse[4], inverse[3] * height + inverse[5],
  ));
  const rect = (box: any, fill: string, opacity = 1) => page.drawRectangle({
    x: box.x / 100 * width, y: height - box.y / 100 * height,
    width: box.width / 100 * width, height: -box.height / 100 * height,
    rotate: degrees(-(box.rotation || 0)), color: color(fill), opacity,
  });
  // Cover originals first so moving one word cannot cover another replacement.
  for (const ann of model.annotations) {
    if (ann.original && textChanged(ann)) {
      rect(originalMaskBounds(ann, model.previewWidth || width * 2, model.previewHeight || height * 2), ann.maskColor || '#ffffff');
    }
  }
  for (const ann of model.annotations) {
    if (ann.isDeleted) continue;
    const x = ann.x / 100 * width, y = height - ann.y / 100 * height;
    const w = ann.width / 100 * width, h = ann.height / 100 * height;
    if (ann.type === 'line') page.drawLine({
      start: { x, y }, end: { x: x + w, y: y - h },
      thickness: (ann.lineWidth || 3) * sx, color: color(ann.color), opacity: ann.opacity ?? 1,
    });
    if (ann.type === 'erase' || ann.type === 'highlight' || (ann.backgroundColor && ann.backgroundColor !== 'transparent')) {
      rect(ann, ann.type === 'erase' ? '#ffffff' : ann.backgroundColor || ann.color || '#ffff00', ann.opacity ?? 1);
    }
    if (ann.type === 'image' && ann.imageData) {
      const image = await doc.embedPng(await fetch(ann.imageData).then(r => r.arrayBuffer()));
      page.drawImage(image, { x, y: y - h, width: w, height: h, opacity: ann.opacity ?? 1 });
    }
    if (ann.type !== 'text' || !ann.content?.trim()) continue;
    const changed = textChanged(ann);
    if (ann.source === 'native' && !changed) continue;
    const key = editingFontName(fallbackAnnotation(ann));
    await prepareBrowserFont(ann);
    const layout = textLayout(ann, model);
    if (!fonts.has(key)) {
      if (!(window as any).fontkit) throw new Error('Unicode yazı tipi desteği yüklenemedi. Sayfayı yenileyin.');
      fonts.set(key, await doc.embedFont(await loadFontBytes(ann), { subset: true }));
    }
    const font = fonts.get(key);
    const supported = new Set(font.getCharacterSet());
    if ([...ann.content].some(char => char !== '\n' && char !== '\r' && !supported.has(char.codePointAt(0)))) {
      if (layout.outlines) {
        throw new Error('Özgün PDF glifleri görüntülenebiliyor, ancak aranabilir Unicode katmanının yazı tipi bu metni desteklemiyor. Yanlış karakterler veya eksik arama metni üretmemek için kaydetme durduruldu; özgün belge değiştirilmedi.');
      }
      throw new Error('Seçilen yazı tipi metindeki bazı karakterleri desteklemiyor. Başka bir yazı tipi seçin.');
    }
    const size = layout.size * sy;
    const baseline = layout.baseline * sy;
    const angle = (ann.rotation || 0) * Math.PI / 180;
    if (ann.textBackgroundColor && ann.textBackgroundColor !== 'transparent') rect(ann, ann.textBackgroundColor);
    const lines = ann.content.replace(/\r/g, '').split('\n');
    if (layout.outlines) {
      const cos = Math.cos(angle), sin = Math.sin(angle);
      page.pushOperators(pushGraphicsState(), concatTransformationMatrix(
        cos * layout.scaleX * sx / sy, -sin * layout.scaleX * sx / sy, sin, cos,
        x - sin * baseline, y - cos * baseline,
      ));
      for (const glyph of layout.outlines.glyphs) {
        if (glyph.path) {
          page.pushOperators(pushGraphicsState(), concatTransformationMatrix(1, 0, 0, -1, glyph.x * sy, -glyph.y * sy));
          page.drawSvgPath(glyph.path, {
            x: 0, y: 0, scale: glyph.scale * sy, color: color(ann.color), opacity: ann.opacity ?? 1,
          });
          page.pushOperators(popGraphicsState());
        }
        // Search/copy keeps logical Unicode, never the subset font's PUA codes.
        page.drawText(glyph.text, { x: glyph.x * sy, y: -glyph.y * sy, size, font, opacity: 0 });
      }
      page.pushOperators(popGraphicsState());
      continue;
    }
    lines.forEach((line, i) => {
      const offset = baseline + i * size * 1.2;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      page.pushOperators(pushGraphicsState(), concatTransformationMatrix(
        cos * layout.scaleX * sx / sy, -sin * layout.scaleX * sx / sy, sin, cos,
        x - sin * offset, y - cos * offset,
      ));
      page.drawText(line, {
        x: 0, y: 0, size, font, color: color(ann.color),
        xSkew: degrees(textFontStyle(ann) === 'italic' ? 12 : 0),
        opacity: ann.source === 'ocr' && !changed ? 0 : ann.opacity ?? 1,
      });
      page.pushOperators(popGraphicsState());
    });
  }
  page.pushOperators(popGraphicsState());
}
