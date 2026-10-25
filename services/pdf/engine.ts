import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, degrees } from 'pdf-lib';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { Worker } from 'tesseract.js';
import { EditorPage, Rect, TextRegion, id, isChanged, intersects } from './model';
import { canvas, loadFonts, makePatches, matchAppearance, sampleAppearance, textWidth, Patch } from './appearance';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
export interface SourceDocument { file: File; bytes: Uint8Array; pdf: PDFDocumentProxy }
export interface PageRender { canvas: HTMLCanvasElement; scale: number }
export class LocalPdfEngine {
  sources: SourceDocument[] = [];
  private worker?: Worker;
  private disposed = false;
  private activeWorker?: Promise<Worker>;
  private renderCache = new Map<string, PageRender>();
  private ocrBusy = false;
  async add(file: File): Promise<EditorPage[]> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
    if (this.disposed) { await pdf.destroy(); throw new Error('Editör kapatıldı.'); }
    const source = this.sources.length;
    const pages: EditorPage[] = [];
    try {
    for (let index = 0; index < pdf.numPages; index++) {
      const page = await pdf.getPage(index + 1);
      const viewport = page.getViewport({ scale: 1 });
      const small = await this.renderPdfPage(page, Math.min(0.4, 220 / viewport.width));
      pages.push({ id: id(), source, index, width: viewport.width, height: viewport.height,
        baseRotation: viewport.rotation, rotation: 0, deleted: false,
        thumbnail: small.canvas.toDataURL('image/jpeg', 0.75), regions: [], marks: [], analysis: 'pending' });
      page.cleanup();
    }
    } catch (error) { await pdf.destroy(); throw error; }
    if (this.disposed) { await pdf.destroy(); throw new Error('Editör kapatıldı.'); }
    this.sources.push({ file, bytes, pdf });
    return pages;
  }
  private async pdfPage(page: EditorPage) { return this.sources[page.source].pdf.getPage(page.index + 1); }
  private async renderPdfPage(page: PDFPageProxy, scale: number): Promise<PageRender> {
    const viewport = page.getViewport({ scale });
    const result = canvas(viewport.width, viewport.height);
    await page.render({ canvasContext: result.getContext('2d')!, viewport }).promise;
    return { canvas: result, scale };
  }
  async render(page: EditorPage): Promise<PageRender> {
    const hit = this.renderCache.get(page.id);
    if (hit) return hit;
    const result = await this.renderPdfPage(await this.pdfPage(page), Math.min(3, Math.sqrt(12_000_000 / (page.width * page.height))));
    // Bound memory to two high-resolution pages. No base64 copies of document pages.
    if (this.renderCache.size >= 2) this.renderCache.delete(this.renderCache.keys().next().value!);
    this.renderCache.set(page.id, result);
    return result;
  }
  async nativeText(page: EditorPage): Promise<TextRegion[]> {
    await loadFonts();
    const pdfPage = await this.pdfPage(page);
    const [content, render] = await Promise.all([pdfPage.getTextContent(), this.render(page)]);
    const viewport = pdfPage.getViewport({ scale: 1 });
    const regions: TextRegion[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim() || item.width <= 0) continue;
      const transform = pdfjs.Util.transform(viewport.transform, item.transform);
      // Non-horizontal text is left intact; OCR can provide an approximate edit region.
      if (Math.abs(Math.atan2(transform[1], transform[0])) > 0.03) continue;
      const size = Math.hypot(transform[2], transform[3]);
      if (!size) continue;
      const styleInfo = content.styles[item.fontName];
      const ascent = styleInfo?.ascent ?? 0.85;
      const descent = Math.abs(styleInfo?.descent ?? 0.2);
      const pdfFont = pdfPage.commonObjs.has(item.fontName) ? pdfPage.commonObjs.get(item.fontName) : undefined;
      const fontName: string = pdfFont?.name || styleInfo?.fontFamily || '';
      const bold = typeof pdfFont?.bold === 'boolean' ? pdfFont.bold : fontName ? /bold|black|heavy/i.test(fontName) : undefined;
      const italic = typeof pdfFont?.italic === 'boolean' ? pdfFont.italic : fontName ? /italic|oblique/i.test(fontName) : undefined;
      const loaded = pdfFont?.loadedName && [...document.fonts].some(font => font.family.replaceAll('\"', '') === pdfFont.loadedName);
      const measureFamily = loaded ? pdfFont.loadedName : /times|serif/i.test(fontName) && !/sans/i.test(fontName) ? 'Noto Serif' : /mono|courier/i.test(fontName) ? 'Roboto Mono' : 'Noto Sans';
      const ctx = canvas(1, 1).getContext('2d')!;
      ctx.font = `${italic ? 'italic' : 'normal'} ${bold ? '700' : '400'} ${size}px "${measureFamily}"`;
      const measured = Math.max(1, ctx.measureText(item.str).width);
      for (const match of item.str.matchAll(/\S+/g)) {
        const prefix = item.str.slice(0, match.index);
        const x = transform[4] + ctx.measureText(prefix).width / measured * item.width;
        const width = ctx.measureText(match[0]).width / measured * item.width;
        const rect = clampRect({ x, y: transform[5] - size * ascent, width, height: size * (ascent + descent) }, page);
        if (rect.width < 0.5 || rect.height < 0.5) continue;
        const appearance = sampleAppearance(render.canvas, rect, render.scale);
        const style = matchAppearance(render.canvas, rect, match[0], render.scale,
          { family: fontName, size, baseline: transform[5] - rect.y, bold, italic });
        // Keep native spacing, but never exceed the PDF's original word extent.
        const region: TextRegion = { ...rect, id: id(), text: match[0], style, source: 'native', confidence: 100, ...appearance };
        regions.push(withOriginal(region));
      }
    }
    return regions;
  }
  async recognize(page: EditorPage, existing: TextRegion[], progress: (message: string) => void, signal?: AbortSignal): Promise<TextRegion[]> {
    if (this.ocrBusy) throw new Error('Başka bir sayfanın OCR işlemi sürüyor.');
    this.ocrBusy = true;
    const abort = () => { void this.worker?.terminate(); this.worker = undefined; this.activeWorker = undefined; };
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const render = await this.render(page);
      await loadFonts();
      progress('OCR motoru cihazda hazırlanıyor…');
      const { createWorker } = await import('tesseract.js');
      this.activeWorker ??= createWorker(['tur', 'eng'], 1, {
        workerPath: `${location.origin}${import.meta.env.BASE_URL}ocr/worker.min.js`,
        corePath: `${location.origin}${import.meta.env.BASE_URL}ocr/`,
        langPath: `${location.origin}${import.meta.env.BASE_URL}ocr/`,
        workerBlobURL: false,
      });
      const worker = await this.activeWorker;
      this.worker = worker;
      if (this.disposed || signal?.aborted) { abort(); throw new DOMException('İşlem iptal edildi.', 'AbortError'); }
      progress('Türkçe ve İngilizce metinler algılanıyor…');
      const { data } = await worker.recognize(render.canvas, {}, { blocks: true, text: true });
      if (signal?.aborted) throw new DOMException('İşlem iptal edildi.', 'AbortError');
      const regions: TextRegion[] = [];
      const words = data.blocks?.flatMap(block => block.paragraphs.flatMap(paragraph => paragraph.lines.flatMap(line => line.words))) || [];
      for (let index = 0; index < words.length; index++) {
        const word = words[index];
        const text = word.text.trim();
        if (!text || word.confidence < 30) continue;
        const { bbox } = word;
        const inkRect = clampRect({ x: bbox.x0 / render.scale, y: bbox.y0 / render.scale,
          width: (bbox.x1 - bbox.x0) / render.scale, height: (bbox.y1 - bbox.y0) / render.scale }, page);
        if (inkRect.width < 0.5 || inkRect.height < 0.5) continue;
        // Avoid duplicating real PDF text and existing OCR even on mixed pages.
        if (existing.some(region => intersects(inkRect, region.original?.rect || region) &&
          intersectionRatio(inkRect, region.original?.rect || region) > 0.45)) continue;
        const appearance = sampleAppearance(render.canvas, inkRect, render.scale);
        const style = matchAppearance(render.canvas, inkRect, text, render.scale);
        const rect = clampRect({ x: inkRect.x - 0.7, y: inkRect.y - 0.7,
          width: inkRect.width + 1.4, height: inkRect.height + 1.4 }, page);
        style.baseline += inkRect.y - rect.y;
        style.offsetX = (style.offsetX || 0) + inkRect.x - rect.x;
        regions.push(withOriginal({ ...rect, id: id(), text, style, source: 'ocr', confidence: word.confidence, ...appearance }));
        if (index % 20 === 0) {
          progress(`Yazı görünümü eşleştiriliyor… ${index + 1}/${words.length}`);
          await new Promise(resolve => setTimeout(resolve, 0));
          if (signal?.aborted) throw new DOMException('İşlem iptal edildi.', 'AbortError');
        }
      }
      return regions;
    } catch (error) {
      void this.worker?.terminate(); this.worker = undefined; this.activeWorker = undefined;
      throw error;
    } finally {
      signal?.removeEventListener('abort', abort);
      this.ocrBusy = false;
    }
  }
  async patches(page: EditorPage, render: PageRender): Promise<Patch[]> {
    await loadFonts();
    const patches = makePatches(render.canvas, page.regions.filter(isChanged), render.scale);
    for (const mark of page.marks) {
      const patch = canvas(Math.abs(mark.width) * render.scale, Math.abs(mark.height) * render.scale);
      const ctx = patch.getContext('2d')!;
      if (mark.type === 'image' && mark.image) {
        const image = new Image(); image.src = mark.image; await image.decode(); ctx.drawImage(image, 0, 0, patch.width, patch.height);
      } else if (mark.type === 'line') {
        ctx.strokeStyle = mark.color; ctx.lineWidth = 1.5 * render.scale;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(patch.width, patch.height); ctx.stroke();
      } else {
        ctx.globalAlpha = mark.type === 'highlight' ? 0.35 : 1;
        ctx.fillStyle = mark.color; ctx.fillRect(0, 0, patch.width, patch.height);
      }
      patches.push({ rect: mark, canvas: patch });
    }
    return patches;
  }
  async export(pages: EditorPage[]): Promise<Uint8Array> {
    const original = this.sources[0];
    if (this.sources.length === 1 && pages.length === original.pdf.numPages && pages.every((page, index) =>
      page.index === index && !page.deleted && !page.rotation && !page.marks.length && !page.regions.some(isChanged))) return original.bytes.slice();
    const result = await PDFDocument.create();
    const sources = await Promise.all(this.sources.map(source => PDFDocument.load(source.bytes)));
    for (const page of pages.filter(page => !page.deleted)) {
      const [output] = await result.copyPages(sources[page.source], [page.index]);
      output.setRotation(degrees((page.baseRotation + page.rotation) % 360));
      if (page.regions.some(isChanged) || page.marks.length) {
        const render = await this.render(page);
        const viewport = (await this.pdfPage(page)).getViewport({ scale: 1 });
        for (const patch of await this.patches(page, render)) {
          const image = await result.embedPng(patch.canvas.toDataURL('image/png'));
          const [x, y] = viewport.convertToPdfPoint(patch.rect.x, patch.rect.y + patch.rect.height);
          output.drawImage(image, { x, y, width: patch.rect.width, height: patch.rect.height,
            rotate: degrees(page.baseRotation % 360) });
        }
      }
      result.addPage(output);
    }
    return result.save();
  }
  async dispose() {
    this.disposed = true;
    const worker = this.worker || await this.activeWorker?.catch(() => undefined);
    await worker?.terminate();
    await Promise.all(this.sources.map(source => source.pdf.destroy()));
    this.renderCache.clear();
  }
}
function withOriginal(region: TextRegion): TextRegion {
  return { ...region, original: { rect: { x: region.x, y: region.y, width: region.width, height: region.height },
    text: region.text, style: { ...region.style } } };
}
function clampRect(rect: Rect, page: Pick<EditorPage, 'width' | 'height'>): Rect {
  const x = Math.max(0, Math.min(page.width, rect.x)), y = Math.max(0, Math.min(page.height, rect.y));
  return { x, y, width: Math.max(0, Math.min(page.width, rect.x + rect.width) - x),
    height: Math.max(0, Math.min(page.height, rect.y + rect.height) - y) };
}
function intersectionRatio(a: Rect, b: Rect) {
  return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)) / Math.max(1, a.width * a.height);
}
