import React, { useEffect, useRef, useState } from 'react';
import type { LocalPdfEngine } from '../../services/pdf/engine';
import { EditorPage, Mark, Tool, displaySize, id, unrotatePoint } from '../../services/pdf/model';
import { canvas } from '../../services/pdf/appearance';

interface Props {
  engine: LocalPdfEngine; page: EditorPage; selected?: string; zoom: number; tool: Tool;
  onSelect: (id?: string) => void; onMove: (id: string, x: number, y: number, record: boolean) => void;
  onMark: (mark: Mark) => void; onText: (x: number, y: number) => void; onError: (message: string) => void;
}
export default function PageCanvas({ engine, page, selected, zoom, tool, onSelect, onMove, onMark, onText, onError }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number; region?: string; dx?: number; dy?: number; panX?: number; panY?: number; recorded?: boolean }>();
  const [draft, setDraft] = useState<Mark>();
  const size = displaySize(page);
  const selectedRegion = page.regions.find(region => region.id === selected);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const render = await engine.render(page);
      const patches = await engine.patches(page, render);
      if (cancelled || !ref.current) return;
      const composed = canvas(render.canvas.width, render.canvas.height);
      const ctx = composed.getContext('2d')!;
      ctx.drawImage(render.canvas, 0, 0);
      for (const patch of patches) ctx.drawImage(patch.canvas, patch.rect.x * render.scale, patch.rect.y * render.scale,
        patch.rect.width * render.scale, patch.rect.height * render.scale);
      const output = ref.current;
      output.width = page.rotation % 180 ? composed.height : composed.width;
      output.height = page.rotation % 180 ? composed.width : composed.height;
      const outputCtx = output.getContext('2d')!;
      if (page.rotation === 90) { outputCtx.translate(output.width, 0); outputCtx.rotate(Math.PI / 2); }
      if (page.rotation === 180) { outputCtx.translate(output.width, output.height); outputCtx.rotate(Math.PI); }
      if (page.rotation === 270) { outputCtx.translate(0, output.height); outputCtx.rotate(-Math.PI / 2); }
      outputCtx.drawImage(composed, 0, 0);
    })().catch(error => { if (!cancelled) onError(error.message); });
    return () => { cancelled = true; };
  }, [engine, page, onError]);
  const transform = page.rotation === 90 ? `translate(${page.height}px, 0) rotate(90deg)` :
    page.rotation === 180 ? `translate(${page.width}px, ${page.height}px) rotate(180deg)` :
    page.rotation === 270 ? `translate(0, ${page.width}px) rotate(270deg)` : undefined;
  function point(event: React.PointerEvent) {
    const rect = wrapper.current!.getBoundingClientRect();
    return unrotatePoint((event.clientX - rect.left) / zoom, (event.clientY - rect.top) / zoom, page);
  }
  return <div ref={wrapper} className="relative shrink-0 shadow-2xl bg-white select-none"
    style={{ width: size.width * zoom, height: size.height * zoom, touchAction: tool === 'hand' ? 'none' : 'pan-x pan-y', cursor: tool === 'hand' ? 'grab' : tool === 'select' ? 'default' : 'crosshair' }}
    onPointerDown={event => {
      if (event.button !== 0) return;
      const p = point(event);
      if (tool === 'hand') {
        const scroller = wrapper.current!.parentElement!;
        gesture.current = { ...p, panX: event.clientX + scroller.scrollLeft, panY: event.clientY + scroller.scrollTop };
      } else if (tool === 'text') { onText(p.x, p.y); return; }
      else if (tool === 'select') {
        const hit = [...page.regions].reverse().find(region => !region.deleted && p.x >= region.x && p.x <= region.x + region.width && p.y >= region.y && p.y <= region.y + region.height);
        onSelect(hit?.id); return;
      } else gesture.current = { ...p };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      const start = gesture.current;
      if (!start) return;
      if (tool === 'hand' && start.panX !== undefined) {
        const scroller = wrapper.current!.parentElement!;
        scroller.scrollLeft = start.panX - event.clientX; scroller.scrollTop = start.panY! - event.clientY; return;
      }
      const p = point(event);
      if (start.region) { onMove(start.region, p.x - start.dx!, p.y - start.dy!, !start.recorded); start.recorded = true; return; }
      setDraft({ id: 'draft', type: tool as Mark['type'], x: Math.max(0, Math.min(start.x, p.x)), y: Math.max(0, Math.min(start.y, p.y)),
        width: Math.min(page.width, Math.max(start.x, p.x)) - Math.max(0, Math.min(start.x, p.x)),
        height: Math.min(page.height, Math.max(start.y, p.y)) - Math.max(0, Math.min(start.y, p.y)), color: tool === 'highlight' ? '#fde047' : tool === 'erase' ? '#ffffff' : '#111827' });
    }}
    onPointerUp={() => { if (draft && draft.width > 0.5 && draft.height > 0.5) onMark({ ...draft, id: id() }); gesture.current = undefined; setDraft(undefined); }}
    onPointerCancel={() => { gesture.current = undefined; setDraft(undefined); }}>
    <canvas ref={ref} aria-label="PDF sayfa önizlemesi" className="block w-full h-full" />
    <div className="absolute top-0 left-0 pointer-events-none origin-top-left" style={{ width: page.width, height: page.height, transform: `scale(${zoom})` }}>
      <div className="absolute top-0 left-0 origin-top-left" style={{ width: page.width, height: page.height, transform }}>
        {tool === 'select' && page.regions.filter(region => !region.deleted).map(region => <div key={region.id}
          className={selected === region.id ? 'absolute border border-blue-500 bg-blue-500/5' : 'absolute border border-transparent hover:border-blue-300'}
          style={{ left: region.x, top: region.y, width: region.width, height: region.height }} />)}
        {selectedRegion && !selectedRegion.deleted && tool === 'select' && <button aria-label="Seçili metni taşı" title="Sürükleyerek taşı"
          className="absolute pointer-events-auto bg-blue-600 text-white rounded text-[9px] px-1 cursor-move"
          style={{ left: selectedRegion.x, top: selectedRegion.y - 14, height: 13 }}
          onPointerDown={event => { event.stopPropagation(); const p = point(event); gesture.current = { ...p, region: selectedRegion.id, dx: p.x - selectedRegion.x, dy: p.y - selectedRegion.y }; wrapper.current!.setPointerCapture(event.pointerId); }}>Taşı</button>}
        {draft && <div className="absolute border border-blue-500 bg-blue-500/20" style={{ left: draft.x, top: draft.y, width: draft.width, height: draft.height }} />}
      </div>
    </div>
  </div>;
}
