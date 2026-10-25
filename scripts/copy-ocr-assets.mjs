import { createRequire } from 'node:module';
import { cp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const target = path.resolve('public/ocr');
await mkdir(target, { recursive: true });
await cp(require.resolve('tesseract.js/dist/worker.min.js'), path.join(target, 'worker.min.js'));
const core = path.dirname(require.resolve('tesseract.js-core/package.json', { paths: [path.dirname(require.resolve('tesseract.js'))] }));
for (const name of await readdir(core)) {
  if (/\.wasm(?:\.js)?$/.test(name)) await cp(path.join(core, name), path.join(target, name));
}
for (const lang of ['tur', 'eng']) {
  await cp(require.resolve(`@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`), path.join(target, `${lang}.traineddata.gz`));
}
console.log('OCR worker, WASM ve dil dosyaları yerel olarak hazır.');
