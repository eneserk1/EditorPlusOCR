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

const sourceFonts = new Map<string, { bytes: Uint8Array; characters: Set<number> }>();
let sourceFontId = 0;

function retainSourceFont(info: any) {
  if (!info?.data || !info.toUnicode || !(window as any).fontkit) return undefined;
  // PDF subset fonts often use remapped glyph codes, not Unicode. Only reuse
  // actual Unicode cmap entries whose PDF mapping is identical.
  try {
    const bytes = new Uint8Array(info.data);
    const font = (window as any).fontkit.create(bytes);
    const characters = new Set<number>(font.characterSet.filter((code: number) => {
      const unicode = typeof info.toUnicode.get === 'function'
        ? info.toUnicode.get(code) : info.toUnicode._map?.[code];
      return unicode === String.fromCodePoint(code) && (!info.toFontChar || info.toFontChar[code] === code);
    }));
    if (!characters.size) return undefined;
    const name = `EditorSource${sourceFontId++}`;
    sourceFonts.set(name, { bytes, characters });
    return name;
  } catch { return undefined; }
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
  const buckets = new Map<string, number>();
  for (let i = 0; i < pixels.length; i += 4) {
    const key = [0, 1, 2].map(k => Math.min(255, Math.round(pixels[i + k] / 16) * 16)).join(',');
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  const bg = [...buckets].sort((a, b) => b[1] - a[1])[0]?.[0].split(',').map(Number) || [255, 255, 255];
  let fg = bg, best = 0;
  for (const [key, count] of buckets) {
    if (count < Math.max(2, width * height * 0.005)) continue;
    const rgb = key.split(',').map(Number);
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
    return remember({
      id: `native-${index}`, type: 'text', source: 'native', content: item.str,
      x: x / canvas.width * 100, y: y / canvas.height * 100,
      width: width / canvas.width * 100, height: height / canvas.height * 100,
      fontSize: size, baseline: ascent, rotation: angle * 180 / Math.PI,
      maskPadding: Math.max(1.5, size * 0.1),
      fontFamily: familyFor(name), detectedFont: name,
      sourceFont: retained.get(item.fontName),
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
  const source = ann.sourceFont && sourceFonts.get(ann.sourceFont);
  if (source && [...(ann.content || '')].every(char => /[\r\n]/.test(char) || source.characters.has(char.codePointAt(0)!))) return ann.sourceFont!;
  return `Editor${ann.fontFamily === 'Courier' ? 'Mono' : ann.fontFamily === 'Times New Roman' ? 'Serif' : 'Sans'}${ann.isBold ? 'Bold' : ''}${ann.isItalic ? 'Italic' : ''}`;
};

export const textFontStyle = (ann: Annotation) =>
  !editingFontName(ann).startsWith('EditorSource') && ann.fontFamily === 'Courier' && ann.isItalic ? 'italic' : 'normal';

let measuringCanvas: HTMLCanvasElement | undefined;
export function textLayout(ann: Annotation, page: Pick<PdfPage, 'previewWidth' | 'previewHeight'>) {
  measuringCanvas ||= document.createElement('canvas');
  const context = measuringCanvas.getContext('2d');
  const nominalSize = ann.fontSize || 24;
  let size = nominalSize, scaleX = ann.textStyle?.width ?? 1;
  const reference = ann.original && ann.useSourceMetrics !== false ? { ...ann, content: ann.original.content } : ann;
  const measure = (text: string, source = false) => {
    if (!context) return undefined;
    const font = source ? reference : ann;
    context.font = `${textFontStyle(font)} ${size}px "${editingFontName(font)}"`;
    return context.measureText(text);
  };
  if (ann.textStyle) size *= ann.textStyle.height;
  else if (ann.original && ann.useSourceMetrics !== false) {
    const metrics = measure(ann.original.content, true);
    const inkHeight = metrics && metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    if (inkHeight && ann.sourceGlyphHeight) size *= ann.sourceGlyphHeight / inkHeight;
    const width = measure(ann.original.content, true)?.width;
    if (width) scaleX = ann.original.width / 100 * (page.previewWidth || 1) / width;
  }
  const metrics = measure('Mg');
  const ascent = metrics?.fontBoundingBoxAscent ?? size * 0.8;
  const descent = metrics?.fontBoundingBoxDescent ?? size * 0.2;
  const sourceMetrics = measure(ann.original?.content || ann.content || 'Mg', true);
  const baseline = ann.source === 'ocr' && ann.useSourceMetrics !== false && ann.original
    ? sourceMetrics?.actualBoundingBoxAscent ?? size * 0.8
    : ann.baseline ?? size * 0.8;
  const lines = (ann.content || '').replace(/\r/g, '').split('\n');
  const width = Math.max(1, ...lines.map(line => measure(line)?.width || 0)) * scaleX;
  const browserBaseline = (size * 1.2 - ascent - descent) / 2 + ascent;
  return {
    size, scaleX, baseline, baselineOffset: baseline - browserBaseline,
    width: Math.max(ann.width / 100 * (page.previewWidth || 1), width + size),
    height: Math.max(ann.height / 100 * (page.previewHeight || 1), baseline + (lines.length - 1) * size * 1.2 + descent + size * 0.6),
    calibration: { width: scaleX, height: size / nominalSize },
  };
}

function loadFontBytes(ann: Annotation) {
  const source = sourceFonts.get(editingFontName(ann));
  if (source) return Promise.resolve(source.bytes.slice().buffer);
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
  const name = editingFontName(ann);
  if (!browserFonts.has(name)) browserFonts.set(name, (async () => {
    const face = new FontFace(name, await loadFontBytes(ann));
    document.fonts.add(await face.load());
  })().catch(error => { browserFonts.delete(name); throw error; }));
  const reference = ann.original && ann.useSourceMetrics !== false ? { ...ann, content: ann.original.content } : ann;
  return editingFontName(reference) === name ? browserFonts.get(name)! :
    Promise.all([browserFonts.get(name)!, prepareBrowserFont(reference)]).then(() => {});
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
    const key = editingFontName(ann);
    await prepareBrowserFont(ann);
    const layout = textLayout(ann, model);
    if (!fonts.has(key)) {
      if (!(window as any).fontkit) throw new Error('Unicode yazı tipi desteği yüklenemedi. Sayfayı yenileyin.');
      fonts.set(key, await doc.embedFont(await loadFontBytes(ann), { subset: true }));
    }
    const font = fonts.get(key);
    const supported = new Set(font.getCharacterSet());
    if ([...ann.content].some(char => char !== '\n' && char !== '\r' && !supported.has(char.codePointAt(0)))) {
      throw new Error('Seçilen yazı tipi metindeki bazı karakterleri desteklemiyor. Başka bir yazı tipi seçin.');
    }
    const size = layout.size * sy;
    const baseline = layout.baseline * sy;
    const angle = (ann.rotation || 0) * Math.PI / 180;
    if (ann.textBackgroundColor && ann.textBackgroundColor !== 'transparent') rect(ann, ann.textBackgroundColor);
    const lines = ann.content.replace(/\r/g, '').split('\n');
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
