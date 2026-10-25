import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bold, Download, Highlighter, Hand, Italic, Loader2, Minus, MousePointer2, Plus, RotateCw, ScanText, Trash2, Type, Undo2, ZoomIn, ZoomOut, Eraser, Redo2, ImagePlus, QrCode, Stamp } from 'lucide-react';
import { LocalPdfEngine } from '../../services/pdf/engine';
import { EditorPage, TextRegion, Tool, fontFamilies, id, isChanged, restoreRegion, displaySize } from '../../services/pdf/model';
import { textOverflow, fitTextRegion } from '../../services/pdf/appearance';
import PageCanvas from './PageCanvas';
import './editor.css';

const EMPTY_FILES: File[] = [];
export default function PdfEditor({ initialFiles = EMPTY_FILES, onBack }: { initialFiles?: File[]; onBack: () => void }) {
  const engineRef = useRef<LocalPdfEngine>();
  if (!engineRef.current) engineRef.current = new LocalPdfEngine();
  const engine = engineRef.current;
  const [pages, setPages] = useState<EditorPage[]>([]);
  const pagesRef = useRef(pages); pagesRef.current = pages;
  const [active, setActive] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const [tool, setTool] = useState<Tool>('select');
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [insertDialog, setInsertDialog] = useState<'qr' | 'watermark'>();
  const [insertText, setInsertText] = useState('');
  const [history, setHistory] = useState<{ past: EditorPage[][]; future: EditorPage[][] }>({ past: [], future: [] });
  const historyRef = useRef(history); historyRef.current = history;
  const input = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const cancelOcr = useRef<AbortController>();
  const editInput = useRef<HTMLInputElement>(null);
  const current = pages.find(page => page.id === active);
  const region = current?.regions.find(region => region.id === selected);
  const hasOverflow = pages.some(page => !page.deleted && page.regions.some(region => isChanged(region) && textOverflow(region)));
  const reportError = useCallback((message: string) => setError(message), []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // React StrictMode briefly remounts effects. Dispose only on an actual unmount.
      setTimeout(() => { if (!mounted.current) { cancelOcr.current?.abort(); void engine.dispose(); } }, 0);
    };
  }, [engine]);
  const commit = useCallback((next: EditorPage[], record = true) => {
    const previous = pagesRef.current;
    if (record) {
      const nextHistory = { past: [...historyRef.current.past.slice(-39), previous], future: [] };
      historyRef.current = nextHistory; setHistory(nextHistory);
    }
    pagesRef.current = next; setPages(next);
  }, []);
  const updatePage = useCallback((pageId: string, update: (page: EditorPage) => EditorPage, record = true) => {
    commit(pagesRef.current.map(page => page.id === pageId ? update(page) : page), record);
  }, [commit]);
  function updateRegion(updates: Partial<TextRegion>) {
    if (!current || !region) return;
    updatePage(current.id, page => ({ ...page, regions: page.regions.map(item => item.id === region.id ? { ...item, ...updates } : item) }));
  }
  async function addFiles(files: File[]) {
    if (busyRef.current || !files.length) return;
    busyRef.current = true; setBusy('PDF sayfaları hazırlanıyor…'); setError('');
    const allAdded: EditorPage[] = [];
    try {
      for (const file of files) {
        if (!file.name.toLowerCase().endsWith('.pdf')) throw new Error('Lütfen PDF dosyası seçin.');
        const added = await engine.add(file);
        if (!mounted.current) return;
        allAdded.push(...added);
      }
    } catch (error) { if (mounted.current) setError((error as Error).message); }
    finally {
      if (mounted.current && allAdded.length) {
        commit([...pagesRef.current, ...allAdded], false);
        setActive(previous => previous || allAdded[0]?.id);
        setHistory({ past: [], future: [] }); historyRef.current = { past: [], future: [] };
      }
      busyRef.current = false; if (mounted.current) setBusy('');
    }
  }
  useEffect(() => {
    if (!initialized.current && initialFiles.length) { initialized.current = true; void addFiles(initialFiles); }
  }, [initialFiles]);

  // Native PDF text is extracted locally on first opening. OCR remains opt-in for image regions.
  useEffect(() => {
    if (!current || current.analysis !== 'pending' || busyRef.current) return;
    busyRef.current = true; setBusy('PDF metinleri okunuyor…');
    engine.nativeText(current).then(regions => {
      if (mounted.current) updatePage(current.id, page => ({ ...page, regions, analysis: 'native' }), false);
    }).catch(error => { if (mounted.current) setError(error.message); }).finally(() => {
      busyRef.current = false; if (mounted.current) setBusy('');
    });
  }, [active, current?.analysis, engine, updatePage]);

  useEffect(() => {
    if (!current) return;
    const size = displaySize(current);
    setZoom(Math.max(0.2, Math.min(1.5, (window.innerWidth - (window.innerWidth > 900 ? 490 : window.innerWidth > 600 ? 350 : 95)) / size.width)));
  }, [active, current?.rotation]);

  async function runOcr() {
    if (!current || busyRef.current) return;
    busyRef.current = true; setError(''); setBusy('OCR hazırlanıyor…');
    const controller = new AbortController(); cancelOcr.current = controller;
    try {
      const existing = current.analysis === 'pending' ? await engine.nativeText(current) : current.regions;
      const found = await engine.recognize(current, existing, message => { if (mounted.current) setBusy(message); }, controller.signal);
      if (!mounted.current) return;
      updatePage(current.id, page => ({ ...page, regions: [...existing, ...found], analysis: existing.some(item => item.source === 'native') ? 'mixed' : 'ocr' }), false);
      setNotice(found.length ? `${found.length} yeni kelime algılandı. Düzenlemek için bir kelime seçin.` : 'Yeni metin bulunamadı. Mevcut metin alanları korundu.');
    } catch (error) {
      if (mounted.current && (error as Error).name !== 'AbortError') setError((error as Error).message);
    } finally { busyRef.current = false; cancelOcr.current = undefined; if (mounted.current) setBusy(''); }
  }
  function undo() {
    const h = historyRef.current;
    if (!h.past.length) return;
    const next = { past: h.past.slice(0, -1), future: [pagesRef.current, ...h.future] };
    historyRef.current = next; setHistory(next); commit(h.past.at(-1)!, false);
  }
  function redo() {
    const h = historyRef.current;
    if (!h.future.length) return;
    const next = { past: [...h.past, pagesRef.current], future: h.future.slice(1) };
    historyRef.current = next; setHistory(next); commit(h.future[0], false);
  }
  function removeRegion() {
    if (!current || !region) return;
    updatePage(current.id, page => ({ ...page, regions: region.original ? page.regions.map(item => item.id === region.id ? { ...item, deleted: true } : item) : page.regions.filter(item => item.id !== region.id) }));
    setSelected(undefined);
  }
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).matches('input, textarea, select, [contenteditable]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      if (event.key === 'Delete' && region && !busy) removeRegion();
      if (event.key === 'Escape') setSelected(undefined);
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  });
  async function save() {
    if (busyRef.current || !pages.some(page => !page.deleted)) return;
    if (hasOverflow) { setError('Bazı metinler alanına sığmıyor. İşaretli metnin alanını genişletin veya yazı boyutunu azaltın.'); return; }
    busyRef.current = true; setBusy('PDF cihazda kaydediliyor…'); setError('');
    try {
      const bytes = await engine.export(pagesRef.current);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      const link = document.createElement('a'); link.href = url; link.download = 'BelgeEditor_duzenlenmis.pdf'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setNotice('PDF hazır. Dosya cihazınızda işlendi.');
    } catch (error) { setError((error as Error).message); }
    finally { busyRef.current = false; if (mounted.current) setBusy(''); }
  }
  function addText(x: number, y: number) {
    if (!current) return;
    const width = Math.min(120, current.width - x), height = Math.min(22, current.height - y);
    if (width < 15 || height < 10) return;
    const added: TextRegion = { id: id(), x, y, width, height, text: 'Metin', source: 'added', confidence: 100,
      background: '#ffffff', complexBackground: false,
      style: { fontFamily: 'Noto Sans', fontSize: 12, bold: false, italic: false, color: '#000000', letterSpacing: 0, baseline: 15 } };
    updatePage(current.id, page => ({ ...page, regions: [...page.regions, added] })); setSelected(added.id); setTool('select');
  }
  async function addImage(file?: File) {
    if (!file || !current || busyRef.current) return;
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = url; await image.decode();
      const c = document.createElement('canvas'); c.width = Math.min(1500, image.width); c.height = c.width * image.height / image.width;
      c.getContext('2d')!.drawImage(image, 0, 0, c.width, c.height);
      const width = Math.min(150, current.width * 0.5), height = Math.min(current.height * 0.5, width * image.height / image.width);
      updatePage(current.id, page => ({ ...page, marks: [...page.marks, { id: id(), type: 'image', x: 24, y: 24, width, height, color: '#000000', image: c.toDataURL() }] }));
    } catch { setError('Görsel okunamadı. PNG veya JPEG deneyin.'); }
    finally { URL.revokeObjectURL(url); }
  }
  async function insertGenerated() {
    if (!current || !insertText.trim() || busyRef.current) return;
    try {
      const c = document.createElement('canvas');
      if (insertDialog === 'qr') {
        const { default: QRious } = await import('qrious');
        new QRious({ element: c, value: insertText.trim(), size: 600, level: 'M' });
        const size = Math.min(100, current.width / 3, current.height / 3);
        updatePage(current.id, page => ({ ...page, marks: [...page.marks, { id: id(), type: 'image', x: 24, y: 24, width: size, height: size, color: '#000000', image: c.toDataURL() }] }));
      } else {
        c.width = 1200; c.height = 400;
        const ctx = c.getContext('2d')!; ctx.font = 'bold 100px "Noto Sans"';
        ctx.fillStyle = 'rgba(128,128,128,0.25)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(insertText.trim(), 600, 200, 1150);
        const width = current.width * 0.8, height = width / 3;
        updatePage(current.id, page => ({ ...page, marks: [...page.marks, { id: id(), type: 'image', x: page.width * 0.1, y: (page.height - height) / 2, width, height, color: '#000000', image: c.toDataURL() }] }));
      }
      setInsertDialog(undefined); setInsertText('');
    } catch { setError('Öğe oluşturulamadı. Lütfen tekrar deneyin.'); }
  }
  const tools: { id: Tool; label: string; icon: typeof Type }[] = [
    { id: 'select', label: 'Seç', icon: MousePointer2 }, { id: 'hand', label: 'Gezin', icon: Hand }, { id: 'text', label: 'Yazı', icon: Type },
    { id: 'highlight', label: 'Vurgula', icon: Highlighter }, { id: 'line', label: 'Çizgi', icon: Minus }, { id: 'erase', label: 'Sil', icon: Eraser },
  ];
  return <div className="pdf-editor">
    <header className="pdf-header">
      <button onClick={onBack} disabled={!!busy} className="pdf-button" aria-label="Ana menüye dön"><ArrowLeft size={18} /></button>
      <div className="mr-auto"><strong>BelgeEditor<span className="text-blue-600">+</span></strong><small className="block text-slate-500">Belgeler cihazınızda işlenir</small></div>
      <button className="pdf-button" onClick={() => input.current?.click()} disabled={!!busy}><Plus size={16} /> PDF ekle</button>
      <button className="pdf-button pdf-primary" onClick={save} disabled={!!busy || !pages.some(page => !page.deleted)}><Download size={16} /> PDF indir</button>
      <input ref={input} type="file" accept="application/pdf,.pdf" multiple aria-label="PDF dosyası seç" className="hidden" onChange={event => { void addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
      <input ref={imageInput} type="file" accept="image/png,image/jpeg" aria-label="Görsel seç" className="hidden" onChange={event => { void addImage(event.target.files?.[0]); event.target.value = ''; }} />
    </header>
    {!!pages.length && <nav className="pdf-toolbar" aria-label="Düzenleme araçları">
      {tools.map(item => <button key={item.id} className={`pdf-button ${tool === item.id ? 'pdf-active' : ''}`} disabled={!!busy} onClick={() => setTool(item.id)} title={item.label} aria-pressed={tool === item.id}><item.icon size={17} /><span>{item.label}</span></button>)}
      <span className="pdf-divider" />
      <button className="pdf-button" onClick={runOcr} disabled={!!busy || !current || current.deleted}><ScanText size={17} /> Metni algıla (OCR)</button>
      <button className="pdf-button" onClick={() => imageInput.current?.click()} disabled={!!busy || !current}><ImagePlus size={17} /> Görsel</button>
      <button className="pdf-button" onClick={() => { setInsertDialog('qr'); setInsertText(''); }} disabled={!!busy || !current}><QrCode size={17} /> QR</button>
      <button className="pdf-button" onClick={() => { setInsertDialog('watermark'); setInsertText('TASLAK'); }} disabled={!!busy || !current}><Stamp size={17} /> Filigran</button>
      <button className="pdf-button" onClick={undo} disabled={!!busy || !history.past.length} aria-label="Geri al"><Undo2 size={17} /></button>
      <button className="pdf-button" onClick={redo} disabled={!!busy || !history.future.length} aria-label="İleri al"><Redo2 size={17} /></button>
      <span className="pdf-divider" />
      <button className="pdf-button" onClick={() => setZoom(value => Math.max(0.2, value - 0.1))} aria-label="Uzaklaştır"><ZoomOut size={17} /></button>
      <span className="text-xs tabular-nums">%{Math.round(zoom * 100)}</span>
      <button className="pdf-button" onClick={() => setZoom(value => Math.min(4, value + 0.1))} aria-label="Yakınlaştır"><ZoomIn size={17} /></button>
    </nav>}
    {(busy || error || notice) && <div className={`pdf-message ${error ? 'pdf-error' : ''}`} role={error ? 'alert' : 'status'}>
      {busy ? <><Loader2 size={16} className="animate-spin" />{busy}{cancelOcr.current && <button className="underline ml-3" onClick={() => cancelOcr.current?.abort()}>İptal</button>}</> : error || notice}
      {!busy && <button className="ml-auto" aria-label="Bildirimi kapat" onClick={() => { setError(''); setNotice(''); }}>×</button>}
    </div>}
    {insertDialog && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setInsertDialog(undefined)}>
      <section role="dialog" aria-modal="true" aria-label={insertDialog === 'qr' ? 'QR kod ekle' : 'Filigran ekle'} className="bg-white rounded-xl p-6 w-full max-w-sm" onClick={event => event.stopPropagation()}>
        <h2 className="font-bold mb-4">{insertDialog === 'qr' ? 'QR kod ekle' : 'Filigran ekle'}</h2>
        <input autoFocus aria-label={insertDialog === 'qr' ? 'QR metni veya adresi' : 'Filigran metni'} className="border rounded p-2 w-full" value={insertText} onChange={event => setInsertText(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setInsertDialog(undefined); if (event.key === 'Enter') void insertGenerated(); }} />
        <div className="flex gap-2 justify-end mt-4"><button className="pdf-button" onClick={() => setInsertDialog(undefined)}>İptal</button><button className="pdf-button pdf-primary" disabled={!insertText.trim()} onClick={insertGenerated}>Ekle</button></div>
      </section>
    </div>}
    {!pages.length ? <main className="pdf-empty" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void addFiles(Array.from(event.dataTransfer.files)); }}>
      <ScanText size={54} className="text-blue-500 mb-5" /><h1>Belgenin görünümünü koruyarak düzenle</h1>
      <p>PDF’ni seç. Mevcut metne tıkla veya taranmış sayfada OCR kullan.</p>
      <button className="pdf-button pdf-primary mt-6" disabled={!!busy} onClick={() => input.current?.click()}>PDF seç</button>
      <small className="mt-5 text-slate-500">Dosyan sunucuya yüklenmez. PDF’yi buraya da bırakabilirsin.</small>
    </main> : <div className="pdf-body">
      <aside className="pdf-pages" aria-label="Sayfalar">
        {pages.map((page, index) => <div key={page.id} className={`pdf-page-card ${page.id === active ? 'pdf-page-active' : ''} ${page.deleted ? 'opacity-40' : ''}`}>
          <button disabled={!!busy} className="w-full" aria-label={`Sayfa ${index + 1}`} onClick={() => { setActive(page.id); setSelected(undefined); }}>
            <img src={page.thumbnail} alt="" className="mx-auto max-h-32" style={{ transform: `rotate(${page.rotation}deg)` }} />
            <span className="text-xs">{index + 1}{page.deleted ? ' · Silindi' : ''}</span>
          </button>
          <div className="flex justify-center gap-2 mt-1">
            <button className="pdf-icon" title="Sayfayı döndür" aria-label={`Sayfa ${index + 1} döndür`} disabled={!!busy} onClick={() => updatePage(page.id, item => ({ ...item, rotation: (item.rotation + 90) % 360 }))}><RotateCw size={14} /></button>
            <button className="pdf-icon" title={page.deleted ? 'Sayfayı geri getir' : 'Sayfayı sil'} aria-label={`Sayfa ${index + 1} sil veya geri getir`} disabled={!!busy} onClick={() => updatePage(page.id, item => ({ ...item, deleted: !item.deleted }))}><Trash2 size={14} /></button>
          </div>
        </div>)}
      </aside>
      <main className="pdf-workspace" aria-busy={!!busy}>
        {current && !current.deleted ? <PageCanvas engine={engine} page={current} selected={selected} zoom={zoom} tool={busy ? 'hand' : tool}
          onSelect={setSelected} onError={reportError} onText={addText}
          onMove={(regionId, x, y, record) => updatePage(current.id, page => ({ ...page, regions: page.regions.map(item => item.id === regionId ? { ...item, x: Math.max(0, Math.min(page.width - item.width, x)), y: Math.max(0, Math.min(page.height - item.height, y)) } : item) }), record)}
          onMark={mark => updatePage(current.id, page => ({ ...page, marks: [...page.marks, mark] }))} /> : <p className="text-white m-auto">Bu sayfa silindi. Sayfayı geri getirebilir veya başka sayfa seçebilirsin.</p>}
      </main>
      <aside className="pdf-properties" aria-label="Metin özellikleri">
        <h2>Metin düzenle</h2>
        {region && !region.deleted ? <>
          <p className="pdf-hint">{region.source === 'native' ? 'PDF metni' : region.source === 'ocr' ? `OCR · %${Math.round(region.confidence)} güven` : 'Yeni metin'} · Font yaklaşık eşleştirilir.</p>
          <label>Metin<input ref={editInput} aria-label="Seçili metin" value={region.text} disabled={!!busy} onChange={event => updateRegion({ text: event.target.value })} /></label>
          <label>Yazı tipi<select value={region.style.fontFamily} disabled={!!busy} onChange={event => updateRegion({ style: { ...region.style, fontFamily: event.target.value as TextRegion['style']['fontFamily'] } })}>{fontFamilies.map(font => <option key={font}>{font}</option>)}</select></label>
          <div className="pdf-fields"><label>Boyut (pt)<input aria-label="Yazı boyutu" type="number" min="3" max="200" step="0.1" value={Number(region.style.fontSize.toFixed(2))} disabled={!!busy} onChange={event => { const size = Number(event.target.value); if (size >= 3 && size <= 200) updateRegion({ style: { ...region.style, fontSize: size, baseline: region.style.baseline * size / region.style.fontSize } }); }} /></label>
            <label>Renk<input aria-label="Yazı rengi" type="color" value={region.style.color} disabled={!!busy} onChange={event => updateRegion({ style: { ...region.style, color: event.target.value } })} /></label></div>
          <div className="flex gap-2"><button className={`pdf-button ${region.style.bold ? 'pdf-active' : ''}`} aria-label="Kalın" aria-pressed={region.style.bold} disabled={!!busy} onClick={() => updateRegion({ style: { ...region.style, bold: !region.style.bold } })}><Bold size={16} /></button>
            <button className={`pdf-button ${region.style.italic ? 'pdf-active' : ''}`} aria-label="İtalik" aria-pressed={region.style.italic} disabled={!!busy} onClick={() => updateRegion({ style: { ...region.style, italic: !region.style.italic } })}><Italic size={16} /></button></div>
          <div className="pdf-fields"><label>Alan eni (pt)<input aria-label="Metin alanı eni" type="number" min="1" max={current.width - region.x} value={Number(region.width.toFixed(2))} disabled={!!busy} onChange={event => { const width = Number(event.target.value); if (width > 0 && width <= current.width - region.x) updateRegion({ width }); }} /></label>
            <label>Alan boyu (pt)<input aria-label="Metin alanı boyu" type="number" min="1" max={current.height - region.y} value={Number(region.height.toFixed(2))} disabled={!!busy} onChange={event => { const height = Number(event.target.value); if (height > 0 && height <= current.height - region.y) updateRegion({ height }); }} /></label></div>
          <label>Harf aralığı (pt)<input aria-label="Harf aralığı" type="number" step="0.05" min="-5" max="30" value={Number(region.style.letterSpacing.toFixed(2))} disabled={!!busy} onChange={event => { const spacing = Number(event.target.value); if (spacing >= -5 && spacing <= 30) updateRegion({ style: { ...region.style, letterSpacing: spacing } }); }} /></label>
          <label>Satır tabanı (pt)<input aria-label="Satır tabanı" type="number" step="0.1" min="0" max={region.height} value={Number(region.style.baseline.toFixed(2))} disabled={!!busy} onChange={event => { const baseline = Number(event.target.value); if (baseline >= 0 && baseline <= region.height) updateRegion({ style: { ...region.style, baseline } }); }} /></label>
          {isChanged(region) && textOverflow(region) && <div className="pdf-warning" role="alert">Metin alana sığmıyor. Alanı genişlet veya yazıyı küçült.<button className="underline block mt-2" disabled={!!busy} onClick={() => updateRegion(fitTextRegion(region, current))}>Alanı metne göre genişlet</button></div>}
          {region.complexBackground && <p className="pdf-warning">Bu bölgede zemin karmaşık. Düzenlenen alanın görünümünü kontrol et; gerekirse geri al.</p>}
          {region.source === 'ocr' && region.confidence < 75 && <p className="pdf-warning">OCR bu kelimeden emin değil. Orijinal metni kontrol et.</p>}
          <div className="flex flex-wrap gap-2 mt-5"><button className="pdf-button" disabled={!!busy || !region.original || !isChanged(region)} onClick={() => updateRegion(restoreRegion(region))}><Undo2 size={15} /> Orijinale dön</button>
            <button className="pdf-button text-red-600" disabled={!!busy} onClick={removeRegion}><Trash2 size={15} /> Metni sil</button></div>
        </> : <><p className="pdf-hint">Sayfadaki bir kelimeye tıkla. Değişiklik yapana kadar belgenin orijinal görüntüsü korunur.</p>
          {current && !current.regions.length && !busy && <button className="pdf-button pdf-primary mt-4" onClick={runOcr}><ScanText size={16} /> Taramadaki metni algıla</button>}
          <p className="pdf-hint mt-5">Yeni yazı eklemek için Yazı aracını seçip sayfaya tıkla. Taşımak için seçili kelimenin Taşı tutamacını sürükle.</p></>}
        {current && current.marks.length > 0 && <div className="mt-6"><h2>Eklenen öğeler</h2>{current.marks.map((mark, index) => <div key={mark.id} className="flex justify-between text-xs py-2"><span>{index + 1}. {mark.type === 'image' ? 'Görsel' : mark.type === 'highlight' ? 'Vurgu' : mark.type === 'line' ? 'Çizgi' : 'Silgi'}</span><button aria-label={`Öğe ${index + 1} sil`} disabled={!!busy} onClick={() => updatePage(current.id, page => ({ ...page, marks: page.marks.filter(item => item.id !== mark.id) }))}><Trash2 size={14} /></button></div>)}</div>}
        <p className="pdf-footnote">Düzenleme görsel olarak uygulanır. Eski metin arama ve kopyalamada görünebilir.</p>
      </aside>
    </div>}
  </div>;
}
