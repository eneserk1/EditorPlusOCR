import { Annotation, PdfPage } from '../types';

const globals = () => window as any;
const id = () => Math.random().toString(36).slice(2);
export const pdfTextChanged = (a: Annotation): boolean => {
  if (!a.source) return true;
  const s = a.source;
  return !!a.isDeleted || a.x !== s.x || a.y !== s.y || a.width !== s.width ||
    a.height !== s.height || Object.entries(s.original).some(([key, value]) => (a as any)[key] !== value);
};

const family = (name: string): NonNullable<Annotation['fontFamily']> =>
  /courier|mono/i.test(name) ? 'Courier' : /times|serif/i.test(name) && !/sans/i.test(name) ? 'Times New Roman' : 'Helvetica';

export const cssPdfFont = (a: Annotation) =>
  `${a.isItalic ? 'italic ' : ''}${a.isBold ? 'bold ' : ''}${a.fontSize || 12}px ${pdfCssFamily(a)}`;

export const pdfCssFamily = (a: Annotation) => a.fontFamily === 'Courier'
  ? '"Belge Mono", "Courier New", monospace' : a.fontFamily === 'Times New Roman'
    ? '"Belge Serif", "Times New Roman", serif' : '"Belge Sans", Arial, Helvetica, sans-serif';

const fontFile = (a: Annotation) => {
  const serif = a.fontFamily === 'Times New Roman';
  const stem = serif ? 'DejaVuSerif' : a.fontFamily === 'Courier' ? 'DejaVuSansMono' : 'DejaVuSans';
  const suffix = a.isBold && a.isItalic ? (serif ? '-BoldItalic' : '-BoldOblique') : a.isBold ? '-Bold' : a.isItalic ? (serif ? '-Italic' : '-Oblique') : '';
  return `${stem}${suffix}.ttf`;
};

let measurementContext: CanvasRenderingContext2D | null = null;
const measureContext = () => measurementContext ||= document.createElement('canvas').getContext('2d');

export function pdfTextWidth(a: Annotation): number {
  const context = measureContext();
  if (!context) return 0;
  context.font = cssPdfFont(a);
  return Math.max(1, ...(a.content || '').split('\n').map(line => context.measureText(line).width)) + 3;
}

export function pdfTextBaseline(a: Annotation): number {
  const size = a.fontSize || 12;
  const context = measureContext();
  if (!context) return size;
  context.font = cssPdfFont(a);
  const metrics = context.measureText('Mg');
  const ascent = metrics.fontBoundingBoxAscent ?? size * .8;
  const descent = metrics.fontBoundingBoxDescent ?? size * .2;
  return ascent + (size * 1.2 - ascent - descent) / 2;
}

export async function previewImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Sayfa görüntüsü yüklenemedi.'));
    image.src = src;
  });
  return image;
}

function colors(canvas: HTMLCanvasElement, x: number, y: number, w: number, h: number) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { background: '#ffffff', color: '#000000' };
  const hex = (v: number[]) => '#' + v.map(n => Math.round(n).toString(16).padStart(2, '0')).join('');
  const left = Math.max(0, Math.min(canvas.width - 1, Math.floor(x - 3)));
  const top = Math.max(0, Math.min(canvas.height - 1, Math.floor(y - 3)));
  const areaWidth = Math.max(1, Math.min(canvas.width, Math.ceil(x + w + 4)) - left);
  const areaHeight = Math.max(1, Math.min(canvas.height, Math.ceil(y + h + 4)) - top);
  const pixels = ctx.getImageData(left, top, areaWidth, areaHeight).data;
  const pixel = (px: number, py: number) => {
    const col = Math.max(0, Math.min(areaWidth - 1, Math.round(px) - left));
    const row = Math.max(0, Math.min(areaHeight - 1, Math.round(py) - top));
    const offset = (row * areaWidth + col) * 4;
    return [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
  };
  const samples = [pixel(x - 2, y - 2), pixel(x + w + 2, y - 2), pixel(x - 2, y + h + 2), pixel(x + w + 2, y + h + 2)];
  const bg = [0, 1, 2].map(c => samples.map(p => p[c]).sort((a, b) => a - b)[2]);
  let fg = bg, distance = 0;
  for (let py = y; py < y + h; py += Math.max(1, h / 16)) {
    for (let px = x; px < x + w; px += Math.max(1, w / 40)) {
      const p = pixel(px, py);
      const d = p.reduce((sum, v, c) => sum + (v - bg[c]) ** 2, 0);
      if (d > distance) { distance = d; fg = p; }
    }
  }
  return { background: hex(bg), color: hex(fg) };
}

function sourced(a: Annotation, kind: 'native' | 'ocr', background: string, extra = {}): Annotation {
  return {
    ...a, originalContent: a.content, isInteractive: true,
    source: {
      kind, x: a.x, y: a.y, width: a.width, height: a.height,
      baseline: a.baseline ?? a.y + a.height * .8, background, ...extra,
      original: { content: a.content || '', fontSize: a.fontSize || 12, fontFamily: a.fontFamily || 'Helvetica',
        isBold: !!a.isBold, isItalic: !!a.isItalic, color: a.color || '#000000' },
    },
  };
}

export async function extractPdfText(page: any, canvas: HTMLCanvasElement): Promise<Annotation[]> {
  const viewport = page.getViewport({ scale: 1 });
  const text = await page.getTextContent();
  const result: Annotation[] = [];
  for (const item of text.items) {
    if (!item.str?.trim() || !item.transform) continue;
    const style = text.styles[item.fontName] || {};
    const m = globals().pdfjsLib.Util.transform(viewport.transform, item.transform);
    const fontSize = Math.hypot(m[2], m[3]);
    if (!fontSize || !m.every(Number.isFinite)) continue;
    const angle = Math.atan2(m[1], m[0]);
    const ascent = (style.ascent ?? (style.descent ? 1 + style.descent : .8)) * fontSize;
    const width = Math.max(item.width * viewport.scale, fontSize * .2);
    const height = fontSize * ((style.ascent ?? .8) - (style.descent ?? -.2));
    const x = m[4] + Math.sin(angle) * ascent, y = m[5] - Math.cos(angle) * ascent;
    let actualFontName = item.fontName;
    try { actualFontName = page.commonObjs.get(item.fontName)?.name || actualFontName; } catch { /* Some PDF.js fonts are not exposed. */ }
    const name = `${actualFontName} ${style.fontFamily || ''}`;
    const sample = colors(canvas, x * canvas.width / viewport.width, y * canvas.height / viewport.height,
      width * canvas.width / viewport.width, height * canvas.height / viewport.height);
    result.push(sourced({
      id: id(), type: 'text', content: item.str, x: x / viewport.width * 100,
      y: y / viewport.height * 100, width: width / viewport.width * 100, height: height / viewport.height * 100,
      fontSize, fontFamily: family(name), isBold: /bold|black|heavy/i.test(name),
      isItalic: /italic|oblique/i.test(name), color: sample.color,
      baseline: m[5] / viewport.height * 100, textAngle: angle * 180 / Math.PI,
    }, 'native', sample.background, { fontName: actualFontName, baselineOffset: ascent }));
  }
  return result;
}

export function mergeOcr(existing: Annotation[], incoming: Annotation[]): Annotation[] {
  // Never replace source records: edited and deleted text must survive another OCR pass.
  const result = [...existing];
  for (const candidate of incoming) {
    const duplicate = result.some(a => {
      if (a.type !== 'text') return false;
      const b = a.source || a;
      const overlap = Math.max(0, Math.min(b.x + b.width, candidate.x + candidate.width) - Math.max(b.x, candidate.x)) *
        Math.max(0, Math.min(b.y + b.height, candidate.y + candidate.height) - Math.max(b.y, candidate.y));
      return overlap / Math.max(.001, Math.min(b.width * b.height, candidate.width * candidate.height)) > .35;
    });
    if (!duplicate) result.push(candidate);
  }
  return result;
}

export async function createPdfOcrWorker(onProgress: (message: string) => void, onWorker?: (worker: any) => void): Promise<any> {
  if (!globals().Tesseract) throw new Error('OCR kitaplığı yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.');
  const worker = globals().Tesseract.createWorker({
    logger: (m: any) => onProgress(`${m.status === 'recognizing text' ? 'Metin tanınıyor' : 'OCR hazırlanıyor'} %${Math.round((m.progress || 0) * 100)}`),
  });
  onWorker?.(worker);
  try {
    await worker.load();
    await worker.loadLanguage('tur+eng');
    await worker.initialize('tur+eng');
    return worker;
  } catch (error) {
    await worker.terminate().catch(() => {});
    onWorker?.(null);
    throw error;
  }
}

export async function recognizePdfPage(worker: any, page: PdfPage): Promise<Annotation[]> {
  const image = await previewImage(page.preview);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  canvas.getContext('2d')!.drawImage(image, 0, 0);
  const { data } = await worker.recognize(canvas);
  const pageHeight = page.viewport?.height || image.naturalHeight / 2;
  return (data.lines || []).filter((line: any) => line.text?.trim() && line.bbox).map((line: any) => {
    const b = line.bbox, h = b.y1 - b.y0;
    const words = line.words || [];
    const sample = colors(canvas, b.x0, b.y0, b.x1 - b.x0, h);
    const baseline = line.baseline?.y0 ?? b.y1 - h * .15;
    const fontName = words.find((w: any) => w.font_name)?.font_name || '';
    return sourced({
      id: id(), type: 'text', content: line.text.trim(),
      x: b.x0 / canvas.width * 100, y: b.y0 / canvas.height * 100,
      width: (b.x1 - b.x0) / canvas.width * 100, height: h / canvas.height * 100,
      baseline: baseline / canvas.height * 100,
      fontSize: Math.max(1, h / canvas.height * pageHeight / .95),
      fontFamily: family(fontName), isBold: !!words[0]?.is_bold, isItalic: !!words[0]?.is_italic,
      color: sample.color,
    }, 'ocr', sample.background, { confidence: line.confidence, fontName, baselineOffset: (baseline - b.y0) / canvas.height * pageHeight });
  });
}

export async function exportEditedPdf(files: File[], pages: PdfPage[]): Promise<Uint8Array> {
  const lib = globals().PDFLib;
  if (!lib) throw new Error('PDF kitaplığı yüklenemedi.');
  const { PDFDocument, StandardFonts, rgb, degrees, pushGraphicsState, popGraphicsState,
    concatTransformationMatrix, beginText, endText, setTextRenderingMode, TextRenderingMode } = lib;
  const doc = await PDFDocument.create();
  if (globals().fontkit) doc.registerFontkit(globals().fontkit);
  const sources = await Promise.all(files.map(async file => PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false })));
  const fonts = new Map<string, any>();
  const unicodeFonts = new Map<string, any>();
  for (const field of ['Title', 'Author', 'Subject', 'Creator', 'Producer', 'CreationDate', 'ModificationDate']) {
    const value = sources[0]?.[`get${field}`]();
    if (value !== undefined) (doc as any)[`set${field}`](value);
  }
  const color = (hex = '#000000') => {
    const valid = /^#[\da-f]{6}$/i.test(hex) ? hex : '#000000';
    return rgb(...[1, 3, 5].map(i => parseInt(valid.slice(i, i + 2), 16) / 255));
  };
  for (const page of pages.filter(p => !p.isDeleted)) {
    const [copy] = await doc.copyPages(sources[page.sourceFileIndex], [page.originalPageIndex]);
    const v = page.viewport || { width: copy.getWidth(), height: copy.getHeight(), transform: [1, 0, 0, -1, 0, copy.getHeight()] };
    const [a, b, c, d, e, f] = v.transform;
    const det = a * d - b * c;
    // Map bottom-left viewport coordinates back into original PDF user space (crop/rotation included).
    copy.pushOperators(pushGraphicsState(), concatTransformationMatrix(
      d / det, -b / det, c / det, -a / det,
      (c * f - d * e - c * v.height) / det, (b * e - a * f + a * v.height) / det));
    const geometry = (r: { x: number; y: number; width: number; height: number }) => ({
      x: r.x * v.width / 100, y: v.height - (r.y + r.height) * v.height / 100,
      width: r.width * v.width / 100, height: r.height * v.height / 100,
    });
    // Mask all original locations before painting replacements, so moved text is not erased by a later mask.
    for (const ann of page.annotations) {
      if (ann.source && pdfTextChanged(ann)) {
        const g = geometry(ann.source);
        const angle = (ann.textAngle || 0) * Math.PI / 180;
        copy.drawRectangle({ ...g, x: g.x - Math.sin(angle) * g.height,
          y: v.height - ann.source.y * v.height / 100 - Math.cos(angle) * g.height,
          rotate: degrees(-(ann.textAngle || 0)), color: color(ann.source.background) });
      }
    }
    for (const ann of page.annotations) {
      const unchangedOcr = ann.source?.kind === 'ocr' && !pdfTextChanged(ann);
      if (ann.isDeleted || (ann.source?.kind === 'native' && !pdfTextChanged(ann))) continue;
      const g = geometry(ann);
      if (ann.type === 'erase' || ann.type === 'highlight') {
        copy.drawRectangle({ ...g, color: color(ann.type === 'erase' ? '#ffffff' : ann.color), opacity: ann.opacity ?? 1 });
      } else if (ann.type === 'line') {
        copy.drawLine({ start: { x: g.x, y: g.y + g.height }, end: { x: g.x + g.width, y: g.y },
          thickness: ann.lineWidth || 2, color: color(ann.color), opacity: ann.opacity ?? 1 });
      } else if (ann.type === 'image' && ann.imageData) {
        copy.drawImage(await doc.embedPng(ann.imageData), { ...g, opacity: ann.opacity ?? 1 });
      } else if (ann.type === 'text' && ann.content) {
        const size = Math.max(1, ann.fontSize || 12);
        const name = ann.fontFamily === 'Courier'
          ? (ann.isBold ? (ann.isItalic ? StandardFonts.CourierBoldOblique : StandardFonts.CourierBold) : ann.isItalic ? StandardFonts.CourierOblique : StandardFonts.Courier)
          : ann.fontFamily === 'Times New Roman'
            ? (ann.isBold ? (ann.isItalic ? StandardFonts.TimesRomanBoldItalic : StandardFonts.TimesRomanBold) : ann.isItalic ? StandardFonts.TimesRomanItalic : StandardFonts.TimesRoman)
            : (ann.isBold ? (ann.isItalic ? StandardFonts.HelveticaBoldOblique : StandardFonts.HelveticaBold) : ann.isItalic ? StandardFonts.HelveticaOblique : StandardFonts.Helvetica);
        const file = fontFile(ann);
        if (!unicodeFonts.has(file)) {
          let unicodeFont = null;
          if (globals().fontkit) {
            const abort = new AbortController();
            const timer = setTimeout(() => abort.abort(), 10000);
            try {
              const response = await fetch(`/fonts/${file}`, { signal: abort.signal });
              if (response.ok) unicodeFont = await doc.embedFont(await response.arrayBuffer(), { subset: true });
            } catch { /* Offline/missing fonts use the safe rendering fallback below. */ }
            finally { clearTimeout(timer); }
          }
          unicodeFonts.set(file, unicodeFont);
        }
        let font = unicodeFonts.get(file);
        if (!font) {
          if (!fonts.has(name)) fonts.set(name, await doc.embedFont(name));
          font = fonts.get(name);
        }
        const baselineOffset = ann.source ? (ann.source.baselineOffset ?? (ann.source.baseline - ann.source.y) * v.height / 100) : size * .8;
        const angle = (ann.textAngle || 0) * Math.PI / 180;
        const baselineX = g.x - Math.sin(angle) * baselineOffset;
        const y = v.height - ann.y * v.height / 100 - Math.cos(angle) * baselineOffset;
        const lines = ann.content.split('\n');
        let encodable = true;
        try {
          const supported = new Set(font.getCharacterSet());
          encodable = Array.from(ann.content.replace(/\n/g, '')).every(char => supported.has(char.codePointAt(0)));
          if (encodable) lines.forEach(line => font.encodeText(line));
        } catch { encodable = false; }
        if (encodable) {
          if (unchangedOcr) copy.pushOperators(pushGraphicsState(), beginText(),
            setTextRenderingMode(TextRenderingMode.Invisible), endText());
          lines.forEach((line, index) => copy.drawText(line, {
            x: baselineX - Math.sin(angle) * index * size * 1.2, y: y - Math.cos(angle) * index * size * 1.2, font, size, color: color(ann.color),
            rotate: degrees(-(ann.textAngle || 0)),
          }));
          if (unchangedOcr) copy.pushOperators(popGraphicsState());
        } else {
          throw new Error('Metin aranabilir kaydedilemedi: Unicode yazı tipi veya bazı karakterler desteklenmiyor. Yerel /fonts dosyalarını ve fontkit yüklemesini kontrol edin ya da desteklenmeyen karakterleri düzeltin.');
        }
      }
    }
    copy.pushOperators(popGraphicsState());
    copy.setRotation(degrees((copy.getRotation().angle + page.rotation) % 360));
    doc.addPage(copy);
  }
  if (!doc.getPageCount()) throw new Error('Kaydetmek için en az bir sayfa bırakın.');
  return doc.save();
}
