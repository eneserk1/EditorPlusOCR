import { LocalPdfEngine } from '../services/pdf/engine';
import { canvas, loadFonts, makePatches, textOverflow, textWidth, fitTextRegion } from '../services/pdf/appearance';
import { TextRegion, id, isChanged, restoreRegion, unrotatePoint } from '../services/pdf/model';
const log = (message: string) => { document.querySelector('#results')!.textContent += message + '\n'; };
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); log('✓ ' + message); }
async function fixture(name: string) { return new File([await (await fetch(`/tests/fixtures/${name}.pdf`)).arrayBuffer()], `${name}.pdf`, { type: 'application/pdf' }); }
function difference(a: HTMLCanvasElement, b: HTMLCanvasElement) {
  if (a.width !== b.width || a.height !== b.height) throw new Error('Render dimensions differ');
  const ad = a.getContext('2d')!.getImageData(0, 0, a.width, a.height).data;
  const bd = b.getContext('2d')!.getImageData(0, 0, b.width, b.height).data;
  let sum = 0, count = 0;
  for (let i = 0; i < ad.length; i++) if (i % 4 !== 3) { sum += Math.abs(ad[i] - bd[i]); count++; }
  return sum / count;
}
document.querySelector<HTMLButtonElement>('#run')!.onclick = async () => {
  const button = document.querySelector<HTMLButtonElement>('#run')!; button.disabled = true;
  document.querySelector('#results')!.textContent = '';
  const engine = new LocalPdfEngine();
  try {
    await loadFonts();
    const file = await fixture('native');
    const pages = await engine.add(file);
    const regions = await engine.nativeText(pages[0]); pages[0].regions = regions; pages[0].analysis = 'native';
    assert(regions.some(region => region.text === '125,00'), 'PDF içindeki metin OCR olmadan okunuyor');
    assert(regions.every(region => !isChanged(region)), 'Analiz belgeyi değiştirmiyor');
    const bytes = await engine.export(pages), original = new Uint8Array(await file.arrayBuffer());
    assert(bytes.length === original.length && bytes.every((byte, index) => byte === original[index]), 'Düzenlenmeyen PDF baytları aynen korunuyor');
    const first = regions.find(region => region.text === '125,00')!;
    assert(first.style.fontFamily === 'Noto Sans' && !first.style.bold, 'Düz PDF yazısı benzer sans ve normal kalınlıkla eşleştiriliyor');
    const styleEdit = { ...first, style: { ...first.style, color: '#e11d48' } };
    assert(isChanged(styleEdit), 'Yalnızca renk/font değişikliği de kaydediliyor');
    assert(!isChanged(restoreRegion(styleEdit)), 'Orijinale dön tüm metin özelliklerini geri alıyor');
    assert(textOverflow({ ...first, text: 'Çok uzun bir yeni metin burada taşmalı' }), 'Uzun metinde taşma algılanıyor');
    const turkish = { ...first, text: 'İıŞşĞğÜüÖöÇç', width: 220 };
    const enlarged = { ...turkish, ...fitTextRegion(turkish, pages[0]) };
    assert(Math.abs((enlarged.y + enlarged.style.baseline) - (first.y + first.style.baseline)) < 0.01, 'Alan genişlerken orijinal satır tabanı yerinde kalıyor');
    assert(!textOverflow(enlarged) && textWidth(enlarged.text, enlarged.style) > 0, 'Türkçe karakterler ölçülüyor ve çizilebiliyor');
    const render = await engine.render(pages[0]);
    assert(makePatches(render.canvas, regions.filter(isChanged), render.scale).length === 0, 'Seçim/analiz için maske veya yeni yazı üretilmiyor');
    pages[0].regions = regions.map(region => region.id === first.id ? { ...region, text: '135,00', style: { ...region.style, color: '#e11d48' } } : region);
    for (let i = 1; i < pages.length; i++) {
      const page = pages[i];
      page.regions = [{ id: id(), x: 45, y: 65, width: 150, height: 30, text: 'İstanbul 135,00', source: 'added', confidence: 100,
        background: '#ffffff', complexBackground: false, style: { fontFamily: 'Noto Serif', fontSize: 16, color: '#e11d48', bold: true, italic: true, baseline: 20, letterSpacing: 0 } }];
    }
    const exported = await engine.export(pages);
    const outputEngine = new LocalPdfEngine();
    const outputPages = await outputEngine.add(new File([exported as BlobPart], 'output.pdf'));
    for (let i = 0; i < pages.length; i++) {
      const inputRender = await engine.render(pages[i]);
      const expected = canvas(inputRender.canvas.width, inputRender.canvas.height), ctx = expected.getContext('2d')!;
      ctx.drawImage(inputRender.canvas, 0, 0);
      for (const patch of await engine.patches(pages[i], inputRender)) ctx.drawImage(patch.canvas, patch.rect.x * inputRender.scale, patch.rect.y * inputRender.scale, patch.rect.width * inputRender.scale, patch.rect.height * inputRender.scale);
      const actual = await outputEngine.render(outputPages[i]);
      const error = difference(expected, actual.canvas);
      assert(error < 0.75, `Önizleme/PDF uyumu: sayfa ${i + 1}, dönüş ${pages[i].baseRotation}°, piksel farkı ${error.toFixed(3)}/255`);
      if (i === 0) { expected.setAttribute('aria-label', 'Beklenen önizleme'); actual.canvas.setAttribute('aria-label', 'Kaydedilen PDF'); document.querySelector('#visuals')!.replaceChildren(expected, actual.canvas); }
    }
    await outputEngine.dispose();
    for (const rotation of [0, 90, 180, 270]) {
      const page = { width: 420, height: 300, rotation };
      const displayed = rotation === 0 ? {x: 20, y: 30} : rotation === 90 ? {x: 270, y: 20} : rotation === 180 ? {x: 400, y: 270} : {x: 30, y: 400};
      const p = unrotatePoint(displayed.x, displayed.y, page);
      assert(p.x === 20 && p.y === 30, `${rotation}° sayfada seçim koordinatları tutarlı`);
    }
    log('Tarama OCR testi çalışıyor…');
    const scanPages = await engine.add(await fixture('scan'));
    const scan = scanPages[0];
    assert((await engine.nativeText(scan)).length === 0, 'Taranmış belge yanlışlıkla gerçek metin sayılmıyor');
    const ocr = await engine.recognize(scan, [], log);
    assert(ocr.some(region => /125[,.]00/.test(region.text)), 'Yerel Türkçe/İngilizce OCR fiyatı algılıyor');
    assert(ocr.some(region => /kahvalt|menü|şişli|istanbul/i.test(region.text)), 'Tarama OCR metin bölgeleri oluşturuyor');
    const duplicate = await engine.recognize(scan, ocr, () => {});
    assert(duplicate.length === 0, 'OCR tekrarında metin alanları çoğalmıyor');
    scan.regions = ocr; scan.analysis = 'ocr';
    const scanBefore = await engine.render(scan);
    const scanNoEdit = await engine.export(scanPages);
    const scanCheck = new LocalPdfEngine(); const checkPages = await scanCheck.add(new File([scanNoEdit as BlobPart], 'scan-no-edit.pdf'));
    assert(difference(scanBefore.canvas, (await scanCheck.render(checkPages[0])).canvas) === 0, 'OCR sonrası düzenlenmeyen taramanın görüntüsü aynı');
    await scanCheck.dispose();
    const price = ocr.find(region => /125[,.]00/.test(region.text))!;
    assert(price.style.fontFamily === 'Noto Sans' && !price.style.bold && !price.style.italic, 'Taramadaki düz fiyat yazısı gereksiz kalın veya italik yapılmıyor');
    scan.regions = ocr.map(region => region.id === price.id ? { ...region, text: '135,00' } : region);
    const changedPatches = await engine.patches(scan, scanBefore);
    assert(changedPatches.length === 2, 'Tarama düzenlemesinde yalnızca eski kelime ve yeni kelime işleniyor');
    assert(price.background !== '#ffffff', 'Taramadaki renkli zemin beyaza çevrilmiyor');
    log('TÜM TESTLER GEÇTİ');
  } catch (error) { log('BAŞARISIZ: ' + (error as Error).stack); }
  finally { await engine.dispose(); button.disabled = false; }
};
