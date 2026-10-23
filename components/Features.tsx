import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Upload, X, Download, FileText, ArrowRight, Loader2, CheckCircle2, RotateCw, Trash2, Save, Plus, ScanText, FilePenLine, MousePointer2, Eraser, Type, ChevronLeft, ZoomIn, ZoomOut, Bold, Palette, Highlighter, Minus, Home, Sparkles, Percent, Hand, MousePointerClick, GitCompare, Stamp, QrCode, Grid, Type as TypeIcon, Copy, FileDiff } from 'lucide-react';
import { FileWithPreview, CompressedResult, PdfPage, Annotation } from '../types';
import { drawPageEdits, editingFontName, extractNativeText, ocrAnnotations, originalMaskBounds, overlapsOriginal, prepareBrowserFont, textFontStyle, textLayout, textChanged } from '../services/pdfEditing';

// --- Helper Components ---
const SectionHeader: React.FC<{ title: string; description: string; onBack: () => void }> = ({ title, description, onBack }) => (
  <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end justify-between border-b border-slate-200/60 pb-4 md:pb-6 animate-fade-in space-y-4 md:space-y-0 flex-shrink-0">
    <div>
      <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-1 md:mb-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">{title}</h2>
      <p className="text-slate-500 text-sm md:text-base">{description}</p>
    </div>
    <button 
      onClick={onBack}
      className="flex items-center justify-center w-full md:w-auto text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 shadow-sm px-5 py-2.5 rounded-full transition-all font-medium text-sm group hover:shadow-md"
    >
      <Home size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" /> Ana Menü
    </button>
  </div>
);

const FileUploader: React.FC<{ onUpload: (files: FileList) => void; accept: string; multiple?: boolean; label?: string; compact?: boolean }> = ({ onUpload, accept, multiple = false, label, compact = false }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  if (compact) {
     return (
        <div 
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:bg-slate-50 hover:border-brand-500 cursor-pointer transition-colors bg-white h-full flex flex-col items-center justify-center min-h-[150px]"
        >
            <input type="file" className="hidden" ref={inputRef} accept={accept} multiple={multiple} onChange={(e) => { if (e.target.files && e.target.files.length > 0) { onUpload(e.target.files); e.target.value = ''; } }} />
            <Upload size={24} className="text-slate-400 mb-2" />
            <span className="text-sm font-bold text-slate-600">{label || 'Dosya Seç'}</span>
        </div>
     );
  }

  return (
    <div 
      onClick={() => inputRef.current?.click()}
      className="border-3 border-dashed border-slate-200 rounded-3xl p-8 md:p-16 text-center hover:bg-white hover:border-brand-500 hover:shadow-2xl hover:shadow-brand-500/10 hover:scale-[1.01] transition-all duration-300 cursor-pointer group bg-slate-50/50 backdrop-blur-sm animate-slide-up h-full flex flex-col justify-center items-center"
    >
      <input 
        type="file" 
        className="hidden" 
        ref={inputRef} 
        accept={accept} 
        multiple={multiple}
        onChange={(e) => {
           if (e.target.files && e.target.files.length > 0) {
             onUpload(e.target.files);
             e.target.value = ''; // Reset input
           }
        }} 
      />
      <div className="w-16 h-16 md:w-24 md:h-24 bg-white rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-4 md:mb-6 shadow-lg shadow-slate-200 text-brand-500 group-hover:bg-brand-500 group-hover:text-white transition-all duration-300 transform group-hover:rotate-3">
        <Upload className="w-8 h-8 md:w-10 md:h-10" />
      </div>
      <h3 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">{label || 'Dosyaları buraya sürükleyin veya seçin'}</h3>
      <p className="text-xs md:text-sm text-slate-400 font-medium tracking-wide">Desteklenenler: {accept.replace(/\./g, '').toUpperCase()}</p>
    </div>
  );
};

// --- Features ---

export const CompressorFeature: React.FC<{ initialFiles?: File[], onBack: () => void }> = ({ initialFiles = [], onBack }) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [results, setResults] = useState<CompressedResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [quality, setQuality] = useState(0.7);
  const [currentStatus, setCurrentStatus] = useState<string>("");

  useEffect(() => {
    if (initialFiles.length > 0) {
        const newFiles = initialFiles.map(file => {
            const f = file as FileWithPreview;
            f.id = Math.random().toString(36).substr(2, 9);
            f.preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
            return f;
        });
        setFiles(prev => [...prev, ...newFiles]);
    }
  }, [initialFiles]);

  const handleUpload = (fileList: FileList) => {
    const newFiles = Array.from(fileList).map(file => {
      const f = file as FileWithPreview;
      f.id = Math.random().toString(36).substr(2, 9);
      f.preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      return f;
    });
    setFiles(prev => [...prev, ...newFiles]);
  };

  const compressImageBlob = async (blob: Blob, quality: number): Promise<Blob> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = URL.createObjectURL(blob);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            canvas.toBlob((b) => {
                if (b) resolve(b);
                else resolve(blob); 
            }, 'image/jpeg', quality);
        };
        img.onerror = () => resolve(blob);
    });
  };

  const processFile = async (file: FileWithPreview): Promise<CompressedResult> => {
    const fileType = file.name.split('.').pop()?.toLowerCase();
    await new Promise(r => setTimeout(r, 200));

    if (file.type.startsWith('image/')) {
        setCurrentStatus(`${file.name} optimize ediliyor...`);
        const compressedBlob = await compressImageBlob(file, quality);
        return {
            originalSize: file.size,
            compressedSize: compressedBlob.size,
            blob: compressedBlob,
            url: URL.createObjectURL(compressedBlob),
            name: file.name
        };
    }

    if (fileType === 'pptx') {
        setCurrentStatus(`${file.name} sunumu analiz ediliyor...`);
        try {
            // @ts-ignore
            const JSZip = window.JSZip;
            if(!JSZip) throw new Error("JSZip not loaded");
            const zip = new JSZip();
            const loadedZip = await zip.loadAsync(file);
            const mediaFolder = loadedZip.folder("ppt/media");
            if (mediaFolder) {
                const filesToCompress: any[] = [];
                mediaFolder.forEach((relativePath: string, file: any) => {
                    if (relativePath.match(/\.(jpg|jpeg|png)$/i)) {
                        filesToCompress.push({ path: relativePath, file });
                    }
                });
                for (const item of filesToCompress) {
                    const content = await item.file.async("blob");
                    const compressed = await compressImageBlob(content, quality);
                    mediaFolder.file(item.path, compressed);
                }
            }
            const outBlob = await zip.generateAsync({ type: "blob" });
            return {
                originalSize: file.size,
                compressedSize: outBlob.size,
                blob: outBlob,
                url: URL.createObjectURL(outBlob),
                name: file.name
            };
        } catch (e) {
            console.error("PPTX Error", e);
            return { originalSize: file.size, compressedSize: file.size, blob: file, url: URL.createObjectURL(file), name: file.name };
        }
    }

    if (fileType === 'pdf') {
        setCurrentStatus(`${file.name} yeniden işleniyor...`);
        try {
            const arrayBuffer = await file.arrayBuffer();
            // @ts-ignore
            if (!window.pdfjsLib) throw new Error("PDF.js not loaded");
            // @ts-ignore
            const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer, isEvalSupported: false }).promise;
            // @ts-ignore
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            for (let i = 1; i <= pdf.numPages; i++) {
                if (i > 1) doc.addPage();
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 1.5 }); 
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const context = canvas.getContext('2d');
                await page.render({ canvasContext: context, viewport }).promise;
                const pageDataUrl = canvas.toDataURL('image/jpeg', quality);
                const pdfWidth = doc.internal.pageSize.getWidth();
                const pdfHeight = (viewport.height * pdfWidth) / viewport.width;
                doc.addImage(pageDataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            }
            const pdfBlob = doc.output('blob');
            return { originalSize: file.size, compressedSize: pdfBlob.size, blob: pdfBlob, url: URL.createObjectURL(pdfBlob), name: file.name };
        } catch (e) {
            console.error("PDF Error", e);
             return { originalSize: file.size, compressedSize: file.size, blob: file, url: URL.createObjectURL(file), name: file.name };
        }
    }
    return { originalSize: file.size, compressedSize: file.size, blob: file, url: URL.createObjectURL(file), name: file.name };
  };

  const handleCompress = async () => {
    setIsProcessing(true);
    setResults([]);
    const processed = [];
    for (const file of files) {
      const result = await processFile(file);
      processed.push(result);
    }
    setResults(processed);
    setCurrentStatus("");
    setIsProcessing(false);
  };

  const formatSize = (bytes: number) => (bytes / 1024 / 1024).toFixed(2) + ' MB';

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 animate-fade-in w-full">
      <SectionHeader title="Akıllı Sıkıştırıcı" description="Görüntü kalitesinden ödün vermeden boyutları küçültün." onBack={onBack} />
      
      {files.length === 0 ? (
        <div className="h-[60vh]">
          <FileUploader onUpload={handleUpload} accept=".jpg,.jpeg,.png,.pdf,.pptx" multiple label="Dosyaları (PDF, JPG, PPTX) sürükleyin" />
        </div>
      ) : (
        <div className="space-y-6 md:space-y-8 animate-slide-up">
          <div className="bg-white/80 backdrop-blur-md p-6 md:p-8 rounded-3xl shadow-xl border border-white/20 ring-1 ring-slate-900/5">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 flex items-center text-lg"><FileText className="mr-2 text-brand-500" size={24}/> Seçilen Dosyalar ({files.length})</h3>
              <button onClick={() => { setFiles([]); setResults([]); }} className="text-sm text-red-500 hover:text-red-700 font-medium px-3 py-1 hover:bg-red-50 rounded-lg transition-colors">Temizle</button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
              {files.map(f => (
                <div key={f.id} className="relative group bg-slate-50 border-2 border-slate-200 hover:border-brand-300 rounded-2xl p-4 flex flex-col items-center justify-center transition-all hover:shadow-lg hover:-translate-y-1">
                  <div className="mb-3 text-slate-400">
                     {f.name.toLowerCase().endsWith('pdf') ? <FileText size={40} className="text-red-500" /> : 
                      f.name.toLowerCase().endsWith('pptx') ? <FileText size={40} className="text-orange-500" /> : 
                      <img src={f.preview} className="h-20 w-full object-contain rounded-lg shadow-sm bg-white" alt="" />
                     }
                  </div>
                  <button 
                    onClick={() => setFiles(files.filter(x => x.id !== f.id))}
                    className="absolute -top-2 -right-2 bg-white rounded-full p-1.5 shadow-md text-slate-400 hover:text-red-500 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all border border-slate-100"
                  >
                    <X size={16} />
                  </button>
                  <p className="text-xs text-slate-700 w-full truncate text-center font-bold mb-1 px-2">{f.name}</p>
                  <p className="text-[10px] text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full font-mono">{formatSize(f.size)}</p>
                </div>
              ))}
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 md:p-8 border border-slate-200/60">
              <div className="flex flex-col md:flex-row items-center md:space-x-12 space-y-6 md:space-y-0">
                <div className="flex-1 w-full">
                  <div className="flex justify-between mb-3">
                    <label className="text-sm font-bold text-slate-700 flex items-center"><Sparkles size={16} className="mr-2 text-brand-500"/> Sıkıştırma Seviyesi</label>
                    <span className="text-sm font-bold text-brand-600 bg-brand-50 px-3 py-1 rounded-full">% {Math.round((1 - quality) * 100)} Güç</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.3" 
                    max="0.9" 
                    step="0.1" 
                    value={quality} 
                    onChange={(e) => setQuality(parseFloat(e.target.value))}
                    className="w-full h-4 bg-slate-200 rounded-full appearance-none cursor-pointer accent-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-500/20"
                  />
                  <div className="flex justify-between mt-2 text-[10px] text-slate-400 uppercase font-bold tracking-wider px-1">
                     <span>Daha İyi Kalite</span>
                     <span>Daha Fazla Sıkıştırma</span>
                  </div>
                </div>
                <button 
                  onClick={handleCompress}
                  disabled={isProcessing}
                  className="w-full md:w-auto bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white px-10 py-5 rounded-2xl font-bold transition-all shadow-xl shadow-brand-500/30 disabled:opacity-50 flex items-center justify-center text-base transform active:scale-95"
                >
                  {isProcessing ? <Loader2 className="animate-spin mr-2" size={24} /> : <Percent size={24} className="mr-2" />}
                  {isProcessing ? 'İşleniyor...' : 'Sıkıştırmayı Başlat'}
                </button>
              </div>
              {currentStatus && (
                  <div className="mt-6 flex items-center justify-center text-brand-600 bg-brand-50 p-3 rounded-xl animate-pulse text-center">
                      <Loader2 className="animate-spin mr-2 shrink-0" size={16} />
                      <span className="text-sm font-bold">{currentStatus}</span>
                  </div>
              )}
            </div>
          </div>

          {results.length > 0 && (
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border border-slate-100 animate-slide-up">
              <div className="flex flex-col md:flex-row items-center justify-between mb-8 space-y-4 md:space-y-0">
                  <h3 className="font-bold text-slate-800 text-xl">Sonuç Raporu</h3>
                  <div className="bg-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm">
                    Toplam Kazanç: {formatSize(results.reduce((acc, curr) => acc + (curr.originalSize - curr.compressedSize), 0))}
                  </div>
              </div>
              
              <div className="space-y-4">
                {results.map((res, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row items-center justify-between p-5 bg-slate-50 hover:bg-white rounded-2xl border border-slate-200 hover:border-brand-200 transition-all group shadow-sm hover:shadow-md space-y-4 md:space-y-0">
                    <div className="flex items-center space-x-5 w-full md:w-auto">
                      <div className="w-14 h-14 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center shadow-sm shrink-0">
                        <CheckCircle2 size={28} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 truncate max-w-[200px] md:max-w-xs text-lg">{res.name}</p>
                        <div className="flex items-center text-xs text-slate-500 mt-2 space-x-3">
                          <span className="line-through opacity-60 font-mono">{formatSize(res.originalSize)}</span>
                          <ArrowRight size={14} className="text-slate-400" /> 
                          <span className="font-bold text-slate-900 font-mono text-sm">{formatSize(res.compressedSize)}</span>
                          <span className={`px-2 py-0.5 rounded-md font-bold ${res.compressedSize < res.originalSize ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                            {res.compressedSize < res.originalSize 
                                ? `-%${Math.round(((res.originalSize - res.compressedSize) / res.originalSize) * 100)}` 
                                : 'Optimum'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <a 
                      href={res.url} 
                      download={`belge_plus_${res.name}`}
                      className="w-full md:w-auto bg-brand-600 text-white hover:bg-brand-700 px-6 py-3 rounded-xl transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center font-bold text-sm transform active:scale-95"
                    >
                      <Download size={18} className="mr-2" /> İndir
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ConverterFeature: React.FC<{ initialFiles?: File[], onBack: () => void }> = ({ initialFiles = [], onBack }) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (initialFiles.length > 0) {
        const newFiles = initialFiles.map(file => {
            const f = file as FileWithPreview;
            f.id = Math.random().toString(36).substr(2, 9);
            f.preview = URL.createObjectURL(file);
            return f;
        });
        setFiles(prev => [...prev, ...newFiles]);
    }
  }, [initialFiles]);

  const handleUpload = (fileList: FileList) => {
    const newFiles = Array.from(fileList).map(file => {
      const f = file as FileWithPreview;
      f.id = Math.random().toString(36).substr(2, 9);
      f.preview = URL.createObjectURL(file);
      return f;
    });
    setFiles(prev => [...prev, ...newFiles]);
  };

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      // @ts-ignore
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (i > 0) doc.addPage();
        const imgProps = doc.getImageProperties(file.preview);
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        doc.addImage(file.preview, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }
      doc.save('belge_plus_converted.pdf');
    } catch (e) {
      console.error(e);
      alert('PDF oluşturulurken bir hata oluştu.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 animate-fade-in w-full">
      <SectionHeader title="Görselden PDF'e" description="Görselleri birleştirip profesyonel PDF dosyası oluştur." onBack={onBack} />
      
      {files.length === 0 ? (
        <div className="h-[60vh]">
            <FileUploader onUpload={handleUpload} accept=".jpg,.jpeg,.png" multiple label="Görselleri sürükleyin" />
        </div>
      ) : (
        <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-white/40 p-6 md:p-10 animate-slide-up">
          <div className="flex justify-between items-center mb-10">
            <div>
                 <h3 className="font-bold text-slate-800 text-xl">Sıralama</h3>
                 <p className="text-sm text-slate-500">Otomatik sıralanır.</p>
            </div>
            <button onClick={() => setFiles([])} className="text-sm text-red-500 hover:text-red-700 bg-red-50 px-4 py-2 rounded-xl font-bold transition-colors">Tümünü Sil</button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 mb-12">
            {files.map((f, index) => (
              <div key={f.id} className="relative group border-2 border-slate-100 rounded-2xl p-3 bg-slate-50 hover:border-brand-400 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
                <span className="absolute -top-3 -left-3 bg-slate-800 text-white text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full z-10 shadow-lg ring-4 ring-white">{index + 1}</span>
                <img src={f.preview} alt="" className="w-full h-32 md:h-40 object-contain bg-white rounded-xl shadow-inner" />
                <button 
                  onClick={() => setFiles(files.filter(x => x.id !== f.id))}
                  className="absolute -top-2 -right-2 bg-white text-slate-400 border hover:bg-red-500 hover:text-white rounded-full p-2 shadow-md transition-colors opacity-100 md:opacity-0 group-hover:opacity-100"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          
          <div className="flex justify-end border-t border-slate-100 pt-8">
             <button 
                onClick={generatePDF}
                disabled={isGenerating}
                className="w-full md:w-auto bg-brand-600 text-white px-12 py-4 rounded-2xl font-bold hover:bg-brand-700 transition-all shadow-xl shadow-brand-500/30 disabled:opacity-50 flex items-center justify-center transform active:scale-95 text-lg"
              >
                {isGenerating && <Loader2 className="animate-spin mr-2" size={24} />}
                {isGenerating ? 'Oluşturuluyor...' : 'PDF Olarak İndir'}
              </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface MergedChunk {
  id: number;
  type: 'common' | 'diff';
  value?: string;
  original?: string;
  new?: string;
  chosen?: 'original' | 'new';
}

export const MergeEditorFeature: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [leftText, setLeftText] = useState("");
    const [rightText, setRightText] = useState("");
    const [mergedChunks, setMergedChunks] = useState<MergedChunk[]>([]);
    const [finalText, setFinalText] = useState("");
    const [isCopied, setIsCopied] = useState(false);
    
    useEffect(() => {
        if (mergedChunks.length === 0) return;

        const text = mergedChunks.map(chunk => {
            if (chunk.type === 'common') {
                return chunk.value;
            }
            if (chunk.chosen === 'original') {
                return chunk.original;
            }
            return chunk.new;
        }).join('');
        setFinalText(text);
    }, [mergedChunks]);

    const handleCompare = () => {
        // @ts-ignore
        const diff = window.Diff;
        if(diff) {
            const d = diff.diffWords(leftText, rightText);
            
            const newChunks: MergedChunk[] = [];
            let i = 0;
            let idCounter = 0;

            while (i < d.length) {
                const part = d[i];
                const nextPart = d[i+1];

                if (part.removed && nextPart?.added) {
                    newChunks.push({
                        id: idCounter++,
                        type: 'diff',
                        original: part.value,
                        new: nextPart.value,
                        chosen: 'new'
                    });
                    i += 2;
                } else if (part.removed) {
                    newChunks.push({
                        id: idCounter++,
                        type: 'diff',
                        original: part.value,
                        new: '',
                        chosen: 'new'
                    });
                    i++;
                } else if (part.added) {
                    newChunks.push({
                        id: idCounter++,
                        type: 'diff',
                        original: '',
                        new: part.value,
                        chosen: 'new'
                    });
                    i++;
                } else {
                    newChunks.push({
                        id: idCounter++,
                        type: 'common',
                        value: part.value
                    });
                    i++;
                }
            }
            setMergedChunks(newChunks);
        }
    };

    const handleChoose = (chunkId: number, choice: 'original' | 'new') => {
        setMergedChunks(prev => 
            prev.map(chunk => 
                chunk.id === chunkId ? { ...chunk, chosen: choice } : chunk
            )
        );
    };

    const handleCopy = () => {
        if (!finalText) return;
        navigator.clipboard.writeText(finalText).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 animate-fade-in w-full h-screen flex flex-col">
            <SectionHeader title="Merge Editör" description="İki metin arasındaki farkları kelime bazında bulun ve birleştirin." onBack={onBack} />
            
            <div className="flex-1 flex flex-col min-h-0 space-y-4">
                {/* Input Textareas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ height: '35%' }}>
                    <div className="flex flex-col">
                        <label className="font-bold text-slate-700 mb-2">Orijinal Metin</label>
                        <textarea 
                            className="w-full h-full bg-white border border-slate-200 rounded-2xl p-4 focus:ring-2 focus:ring-brand-500 outline-none resize-none shadow-sm" 
                            placeholder="Buraya yapıştırın..."
                            value={leftText}
                            onChange={(e) => setLeftText(e.target.value)}
                        ></textarea>
                    </div>
                    <div className="flex flex-col">
                        <label className="font-bold text-slate-700 mb-2">Değiştirilmiş Metin</label>
                        <textarea 
                            className="w-full h-full bg-white border border-slate-200 rounded-2xl p-4 focus:ring-2 focus:ring-brand-500 outline-none resize-none shadow-sm" 
                            placeholder="Buraya yapıştırın..."
                            value={rightText}
                            onChange={(e) => setRightText(e.target.value)}
                        ></textarea>
                    </div>
                </div>
                
                {/* Compare Button */}
                <div className="flex-shrink-0 flex justify-center py-2">
                    <button onClick={handleCompare} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold flex items-center shadow-lg hover:bg-slate-800 transition-transform active:scale-95">
                        <FileDiff className="mr-2" /> Farkları Bul
                    </button>
                </div>
                
                {/* Results Area */}
                {mergedChunks.length > 0 && (
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 overflow-hidden">
                        {/* Interactive Diff View */}
                        <div className="flex flex-col bg-white p-4 rounded-3xl border border-slate-200 shadow-xl min-h-0">
                            <h3 className="font-bold text-lg mb-2 flex-shrink-0">Farkları Çözümle</h3>
                            <p className="text-sm text-slate-500 mb-4 flex-shrink-0">Metnin son halinde kalmasını istediğiniz kısımları seçin.</p>
                            <div className="flex-1 overflow-y-auto pr-2">
                                <div className="leading-relaxed text-base whitespace-pre-wrap font-mono p-4 bg-slate-50 rounded-xl">
                                    {mergedChunks.map((chunk) => {
                                        if (chunk.type === 'common') {
                                            return <span key={chunk.id} className="text-slate-600">{chunk.value}</span>;
                                        }
                                        const originalChosen = chunk.chosen === 'original';
                                        const newChosen = chunk.chosen === 'new';
                                        return (
                                            <span key={chunk.id} className="inline-flex flex-wrap gap-1 mx-1 items-center align-middle my-0.5">
                                                {chunk.original && (
                                                    <button
                                                        onClick={() => handleChoose(chunk.id, 'original')}
                                                        className={`px-2 py-0.5 rounded-lg transition-all text-left text-sm ${originalChosen ? 'bg-red-200 text-red-900 ring-2 ring-red-400 font-bold' : 'bg-red-50 text-red-700 hover:bg-red-100 line-through decoration-red-400'}`}
                                                    >
                                                        {chunk.original}
                                                    </button>
                                                )}
                                                {chunk.new && (
                                                    <button
                                                        onClick={() => handleChoose(chunk.id, 'new')}
                                                        className={`px-2 py-0.5 rounded-lg transition-all text-left text-sm ${newChosen ? 'bg-green-200 text-green-900 ring-2 ring-green-400 font-bold' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                                                    >
                                                        {chunk.new}
                                                    </button>
                                                )}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
        
                        {/* Final Text View */}
                        <div className="flex flex-col bg-slate-50/80 p-4 rounded-3xl border border-slate-200/80 shadow-inner min-h-0">
                             <div className="flex justify-between items-center mb-4 flex-shrink-0">
                                <h3 className="font-bold text-lg text-slate-800">Sonuç Metni</h3>
                                <button 
                                    onClick={handleCopy}
                                    className="bg-white hover:bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-bold flex items-center transition-colors text-sm shadow-sm border border-slate-200"
                                >
                                    {isCopied ? <CheckCircle2 size={16} className="mr-2 text-green-600"/> : <Copy size={16} className="mr-2"/>}
                                    {isCopied ? 'Kopyalandı!' : 'Kopyala'}
                                </button>
                             </div>
                             <div className="flex-1 overflow-y-auto pr-2">
                                <div className="w-full bg-white rounded-2xl p-4 text-slate-800 whitespace-pre-wrap text-sm shadow-sm h-full">
                                    {finalText}
                                </div>
                             </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export const PdfComparatorFeature: React.FC<{ initialFiles?: File[], onBack: () => void }> = ({ initialFiles = [], onBack }) => {
    const [file1, setFile1] = useState<File | null>(null);
    const [file2, setFile2] = useState<File | null>(null);
    const [preview1, setPreview1] = useState<string | null>(null);
    const [preview2, setPreview2] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'side' | 'overlay'>('side');

    useEffect(() => {
        if (initialFiles && initialFiles.length > 0) {
            setFile1(initialFiles[0]);
            if (initialFiles.length > 1) {
                setFile2(initialFiles[1]);
            }
        }
    }, [initialFiles]);

    const loadPdfFirstPage = async (file: File): Promise<string> => {
        const arrayBuffer = await file.arrayBuffer();
        // @ts-ignore
        if(!window.pdfjsLib) throw new Error("PDF.js not ready");
        // @ts-ignore
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer, isEvalSupported: false }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        await page.render({ canvasContext: context, viewport }).promise;
        return canvas.toDataURL();
    };

    const handleCompare = async () => {
        if (!file1 || !file2) return;
        setLoading(true);
        try {
            const p1 = await loadPdfFirstPage(file1);
            const p2 = await loadPdfFirstPage(file2);
            setPreview1(p1);
            setPreview2(p2);
        } catch (e) {
            console.error(e);
            alert('PDF işlenirken hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 animate-fade-in w-full">
            <SectionHeader title="PDF Karşılaştırma" description="İki PDF belgesi arasındaki farkları görsel olarak tespit edin." onBack={onBack} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mb-8">
                <div className="h-40 md:h-48">
                    {file1 ? (
                        <div className="bg-brand-50 border-2 border-brand-200 rounded-2xl p-6 flex flex-col items-center justify-center h-full relative">
                            <FileText size={40} className="text-brand-500 mb-2"/>
                            <p className="font-bold text-brand-900 text-center text-sm">{file1.name}</p>
                            <button onClick={() => { setFile1(null); setPreview1(null); }} className="absolute top-2 right-2 p-1 bg-white rounded-full text-red-500 hover:bg-red-50"><X size={16}/></button>
                        </div>
                    ) : (
                        <FileUploader onUpload={(l) => setFile1(l[0])} accept=".pdf" label="Orijinal PDF" compact />
                    )}
                </div>
                <div className="h-40 md:h-48">
                    {file2 ? (
                        <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-6 flex flex-col items-center justify-center h-full relative">
                             <FileText size={40} className="text-purple-500 mb-2"/>
                             <p className="font-bold text-purple-900 text-center text-sm">{file2.name}</p>
                             <button onClick={() => { setFile2(null); setPreview2(null); }} className="absolute top-2 right-2 p-1 bg-white rounded-full text-red-500 hover:bg-red-50"><X size={16}/></button>
                        </div>
                    ) : (
                        <FileUploader onUpload={(l) => setFile2(l[0])} accept=".pdf" label="Değiştirilmiş PDF" compact />
                    )}
                </div>
            </div>

            <div className="flex justify-center mb-8">
                <button 
                    onClick={handleCompare} 
                    disabled={!file1 || !file2 || loading}
                    className="w-full md:w-auto bg-slate-900 text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center shadow-lg hover:bg-slate-800 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="animate-spin mr-2"/> : <GitCompare className="mr-2"/>}
                    Karşılaştır
                </button>
            </div>

            {preview1 && preview2 && (
                <div className="bg-slate-100 p-4 md:p-8 rounded-3xl border border-slate-200 animate-slide-up">
                    <div className="flex justify-center space-x-4 mb-6">
                        <button onClick={() => setViewMode('side')} className={`px-4 py-2 rounded-lg font-bold ${viewMode === 'side' ? 'bg-white shadow-md text-brand-600' : 'text-slate-500'}`}>Yan Yana</button>
                        <button onClick={() => setViewMode('overlay')} className={`px-4 py-2 rounded-lg font-bold ${viewMode === 'overlay' ? 'bg-white shadow-md text-brand-600' : 'text-slate-500'}`}>Çakışık (Fark)</button>
                    </div>

                    {viewMode === 'side' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white p-2 rounded-xl shadow-sm"><img src={preview1} className="w-full h-auto rounded-lg" /></div>
                            <div className="bg-white p-2 rounded-xl shadow-sm"><img src={preview2} className="w-full h-auto rounded-lg" /></div>
                        </div>
                    ) : (
                        <div className="relative w-full max-w-2xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
                             <img src={preview1} className="w-full h-auto absolute top-0 left-0 mix-blend-multiply opacity-50" style={{ filter: 'sepia(1) hue-rotate(300deg) saturate(2)' }} />
                             <img src={preview2} className="w-full h-auto relative mix-blend-multiply opacity-50" style={{ filter: 'sepia(1) hue-rotate(100deg) saturate(2)' }} />
                             <div className="absolute bottom-4 left-4 bg-white/90 p-2 rounded-lg text-xs font-bold flex items-center space-x-3 shadow-md z-10">
                                 <div className="flex items-center"><div className="w-3 h-3 bg-red-400 rounded-full mr-1"></div> Orijinal</div>
                                 <div className="flex items-center"><div className="w-3 h-3 bg-green-400 rounded-full mr-1"></div> Yeni</div>
                             </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export const PdfEditorFeature: React.FC<{ initialFiles?: File[], onBack: () => void }> = ({ initialFiles = [], onBack }) => {
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [pages, setPages] = useState<PdfPage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  
  // Tools
  const [activeTab, setActiveTab] = useState<'edit' | 'insert'>('edit');
  const [activeTool, setActiveTool] = useState<'cursor' | 'hand' | 'erase' | 'text' | 'line' | 'highlight'>('cursor');
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState('');
  const [textSearch, setTextSearch] = useState('');
  const [, refreshFonts] = useState(0);
  const ocrLock = useRef(false);
  const importLock = useRef(false);
  const sourceFileCount = useRef(0);
  const initializedFiles = useRef(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  
  // Modal States
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrText, setQrText] = useState("");
  const [showWatermarkModal, setShowWatermarkModal] = useState(false);
  const [watermarkText, setWatermarkText] = useState("TASLAK");

  // Drawing, Panning, Dragging State
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [startCoords, setStartCoords] = useState<{x: number, y: number} | null>(null);
  const [tempAnnotation, setTempAnnotation] = useState<Annotation | null>(null);
  
  // Dragging Annotation State
  const [draggingAnnotationId, setDraggingAnnotationId] = useState<string | null>(null);
  const [dragStartOffset, setDragStartOffset] = useState<{x: number, y: number} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const previousZoom = useRef(100);
  const panOrigin = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const textInsertRequest = useRef(0);
  const editorContext = useRef({ pageId: editingPageId, tool: activeTool });
  editorContext.current = { pageId: editingPageId, tool: activeTool };

  // Initialize
  useEffect(() => {
    if (!initialFiles.length || initializedFiles.current) return;
    initializedFiles.current = true;
    void (async () => { for (const file of initialFiles) await addFileAndRender(file); })();
  }, [initialFiles]);

  // Keyboard Delete Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (!editingPageId || !selectedAnnotationId) return;
        if (e.key === 'Delete' || e.key === 'Backspace') {
             const activeEl = document.activeElement;
             if (['TEXTAREA', 'INPUT', 'SELECT'].includes(activeEl?.tagName || '')) return;
             deleteAnnotation(editingPageId, selectedAnnotationId);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingPageId, selectedAnnotationId]);

  const editingPage = editingPageId ? pages.find(p => p.uniqueId === editingPageId) : null;

  useEffect(() => {
    const text = editingPage?.annotations.filter(a => a.type === 'text' && !a.isDeleted && (textChanged(a) || a.id === selectedAnnotationId)) || [];
    let cancelled = false;
    const unique = [...new Map(text.map(a => [editingFontName(a), a])).values()];
    Promise.all(unique.map(prepareBrowserFont)).then(() => {
      if (!cancelled) refreshFonts(n => n + 1);
    }).catch(() => {
      if (!cancelled) setDetectionStatus('Yazı tipi önizlemesi yüklenemedi; kaydetmek için internet bağlantısı gerekir.');
    });
    return () => { cancelled = true; };
  }, [editingPage?.annotations, selectedAnnotationId]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container && editingPage) {
      const oldScale = previousZoom.current / 100, scale = zoomLevel / 100;
      const width = editingPage.previewWidth || 1, height = editingPage.previewHeight || 1;
      const center = (length: number, viewport: number, scroll: number) =>
        (scroll + viewport / 2 - Math.max(24, (viewport - length * oldScale) / 2)) / oldScale * scale +
        Math.max(24, (viewport - length * scale) / 2) - viewport / 2;
      container.scrollLeft = center(width, container.clientWidth, container.scrollLeft);
      container.scrollTop = center(height, container.clientHeight, container.scrollTop);
    }
    previousZoom.current = zoomLevel;
  }, [zoomLevel]);

  // Fit on opening/resizing; the stage itself supplies the scrollable extents.
  useEffect(() => {
    if (!editingPageId || !containerRef.current || !imageRef.current) {
        return;
    }

    const container = containerRef.current;
    const image = imageRef.current;

    const setZoomAndPosition = () => {
        // Add some padding to not stick to the edges
        const PADDING = 48;
        const containerWidth = container.clientWidth - PADDING;
        const containerHeight = container.clientHeight - PADDING;

        const imageWidth = image.naturalWidth;
        const imageHeight = image.naturalHeight;

        if (imageWidth > 0 && imageHeight > 0) {
            const scaleX = containerWidth / imageWidth;
            const scaleY = containerHeight / imageHeight;
            const newZoom = Math.min(scaleX, scaleY) * 100;
            setZoomLevel(Math.max(20, Math.min(400, Math.floor(newZoom))));
        }
    };

    if (image.complete) {
        setZoomAndPosition();
    } else {
        image.addEventListener('load', setZoomAndPosition, { once: true });
    }

    let viewportWidth = window.innerWidth, viewportHeight = window.innerHeight;
    const observer = new ResizeObserver(() => {
      if (viewportWidth === window.innerWidth && viewportHeight === window.innerHeight) return;
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
      setZoomAndPosition();
    });
    observer.observe(container, { box: 'border-box' });
    return () => {
        observer.disconnect();
        image.removeEventListener('load', setZoomAndPosition);
    };
  }, [editingPageId, editingPage?.rotation]);


  const addFileAndRender = async (file: File) => {
    if (importLock.current) return;
    importLock.current = true;
    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      // @ts-ignore
      if(!window.pdfjsLib) throw new Error("PDF.js not loaded");
      // @ts-ignore
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer, isEvalSupported: false, fontExtraProperties: true }).promise;
      const newPages: PdfPage[] = [];
      const newFileIndex = sourceFileCount.current;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // Slightly lower scale for mobile perfs
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        setDetectionStatus(`Sayfa ${i}/${pdf.numPages}: PDF metni ve yazı tipi ölçüleri okunuyor…`);
        let annotations: Annotation[] = [];
        try {
          annotations = await extractNativeText(page, viewport, canvas);
        } catch (error) {
          console.warn('PDF text extraction failed; OCR remains available.', error);
        }
        const displayViewport = page.getViewport({ scale: 1 });
        newPages.push({
          uniqueId: Math.random().toString(36).substr(2, 9),
          sourceFileIndex: newFileIndex,
          originalPageIndex: i - 1,
          preview: canvas.toDataURL(),
          rotation: 0,
          isDeleted: false,
          annotations,
          previewWidth: canvas.width, previewHeight: canvas.height,
          displayWidth: displayViewport.width, displayHeight: displayViewport.height,
          viewportTransform: displayViewport.transform,
        });
      }
      setSourceFiles(prev => [...prev, file]);
      sourceFileCount.current += 1;
      setPages(prev => [...prev, ...newPages]);
      setDetectionStatus('PDF metni hazır. Taranmış sayfalarda OCR kullanın. Yazı tipi eşleştirmesi ve renkler tahminidir.');
      await pdf.destroy();
    } catch (e) {
      console.error(e);
      alert("PDF okunurken bir hata oluştu.");
    } finally {
      setIsProcessing(false);
      importLock.current = false;
    }
  };

  const handleInitialUpload = async (fileList: FileList) => {
    if (importLock.current) return;
    for (const file of Array.from(fileList)) await addFileAndRender(file);
  };

  const handleRotate = (uniqueId: string) => {
    setPages(pages.map(p => 
      p.uniqueId === uniqueId ? { ...p, rotation: (p.rotation + 90) % 360 } : p
    ));
  };

  const handleDelete = (uniqueId: string) => {
    setPages(pages.map(p => 
      p.uniqueId === uniqueId ? { ...p, isDeleted: !p.isDeleted } : p
    ));
  };

  // --- Logic for Insert ---
  const addQrCode = () => {
     if (!editingPageId || !qrText) return;
     // @ts-ignore
     const qr = new window.QRious({ value: qrText, size: 200 });
     const dataUrl = qr.toDataURL();

     const newAnn: Annotation = {
        id: Math.random().toString(),
        type: 'image',
        x: 40, y: 40, width: 15, height: 15, // Aspect ratio 1:1 roughly
        imageData: dataUrl,
        isInteractive: false
     };
     setPages(prev => prev.map(p => p.uniqueId === editingPageId ? { ...p, annotations: [...p.annotations, newAnn] } : p));
     setShowQrModal(false);
     setQrText("");
  };

  const applyWatermark = () => {
     setPages(prev => prev.map(p => {
         const canvas = document.createElement('canvas');
         canvas.width = 500;
         canvas.height = 500;
         const ctx = canvas.getContext('2d');
         if(ctx) {
             ctx.translate(250, 250);
             ctx.rotate(-45 * Math.PI / 180);
             ctx.font = 'bold 80px Helvetica';
             ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
             ctx.textAlign = 'center';
             ctx.fillText(watermarkText, 0, 0);
         }
         const dataUrl = canvas.toDataURL();
         const wm: Annotation = {
             id: Math.random().toString(),
             type: 'image',
             x: 25, y: 25, width: 50, height: 50,
             imageData: dataUrl,
             opacity: 0.5,
             isInteractive: false
         };
         return { ...p, annotations: [...p.annotations, wm] };
     }));
     setShowWatermarkModal(false);
  };

  // --- Pointer Event Handlers (Mouse + Touch) ---
  const handlePointerDown = async (e: React.PointerEvent) => {
    if (!editingPageId || !containerRef.current) return;
    
    // Pan Logic
    if (activeTool === 'hand') {
        if (e.pointerType === 'touch') return;
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        panOrigin.current = { x: e.clientX, y: e.clientY, left: containerRef.current.scrollLeft, top: containerRef.current.scrollTop };
        setIsPanning(true);
        return;
    }

    // Select/Draw Logic
    if (activeTool === 'cursor') {
        setSelectedAnnotationId(null);
        return;
    }

    e.preventDefault(); // Prevent default touch actions (scrolling) when drawing
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (activeTool === 'text') {
        const request = ++textInsertRequest.current;
        const page = editingPage!;
        const candidates = page.annotations.filter(a => a.type === 'text' && !a.isDeleted);
        const inherited = candidates.find(a => a.id === selectedAnnotationId) || candidates.reduce<Annotation | undefined>((nearest, a) => {
            const distance = (ann: Annotation) => {
                const dx = Math.max(ann.x - x, 0, x - ann.x - ann.width) * (page.previewWidth || 1);
                const dy = Math.max(ann.y - y, 0, y - ann.y - ann.height) * (page.previewHeight || 1);
                return dx * dx + dy * dy;
            };
            return !nearest || distance(a) < distance(nearest) ? a : nearest;
        }, undefined);
        const newAnnotation: Annotation = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'text',
            x, y, width: 1, height: 1,
            content: 'Metin',
            fontSize: inherited?.fontSize || 12 * (page.previewHeight || 2) / (page.displayHeight || 1),
            fontFamily: inherited?.fontFamily || 'Helvetica',
            color: inherited?.color || '#000000',
            isBold: inherited?.isBold || false,
            isItalic: inherited?.isItalic || false,
            sourceFont: inherited?.sourceFont,
            rotation: inherited?.rotation,
            backgroundColor: 'transparent'
        };
        try {
            const reference = inherited ? { ...inherited, content: newAnnotation.content } : newAnnotation;
            await prepareBrowserFont(reference);
            if (request !== textInsertRequest.current || editorContext.current.pageId !== page.uniqueId || editorContext.current.tool !== 'text') return;
            if (inherited) {
                const layout = textLayout(reference, page);
                newAnnotation.textStyle = layout.calibration;
                newAnnotation.baseline = layout.baseline;
            }
        } catch {
            if (request === textInsertRequest.current && editorContext.current.pageId === page.uniqueId) {
                setDetectionStatus('Yazı tipi yüklenemedi; metin eklemek için internet bağlantınızı kontrol edin.');
            }
            return;
        }
        setPages(prev => prev.map(p =>
            p.uniqueId === editingPageId ? { ...p, annotations: [...p.annotations, newAnnotation] } : p
        ));
        setSelectedAnnotationId(newAnnotation.id);
        setActiveTool('cursor'); 
        return;
    }

    setIsDrawing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    setStartCoords({ x, y });
    setTempAnnotation({
        id: 'temp',
        type: activeTool,
        x, y, width: 0, height: 0,
        color: activeTool === 'highlight' ? '#fde047' : '#000000',
        opacity: activeTool === 'highlight' ? 0.4 : 1,
        lineWidth: 3
    });
    setSelectedAnnotationId(null);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // Panning
    if (isPanning && panOrigin.current && containerRef.current) {
        e.preventDefault();
        const origin = panOrigin.current;
        containerRef.current.scrollLeft = origin.left - (e.clientX - origin.x);
        containerRef.current.scrollTop = origin.top - (e.clientY - origin.y);
        return;
    }

    // Dragging Annotation
    if (draggingAnnotationId && dragStartOffset && canvasRef.current && editingPageId) {
        e.preventDefault();
        const rect = canvasRef.current.getBoundingClientRect();
        const currentX = ((e.clientX - rect.left) / rect.width) * 100;
        const currentY = ((e.clientY - rect.top) / rect.height) * 100;
        
        updateAnnotation(editingPageId, draggingAnnotationId, {
            x: currentX - dragStartOffset.x,
            y: currentY - dragStartOffset.y
        });
        return;
    }

    // Drawing
    if (!isDrawing || !startCoords || !tempAnnotation || !canvasRef.current) return;
    e.preventDefault();
    
    const rect = canvasRef.current.getBoundingClientRect();
    const currentX = ((e.clientX - rect.left) / rect.width) * 100;
    const currentY = ((e.clientY - rect.top) / rect.height) * 100;

    if (activeTool === 'line') {
         setTempAnnotation({
             ...tempAnnotation,
             width: currentX - startCoords.x,
             height: currentY - startCoords.y
         });
    } else {
        const x = Math.min(currentX, startCoords.x);
        const y = Math.min(currentY, startCoords.y);
        const width = Math.abs(currentX - startCoords.x);
        const height = Math.abs(currentY - startCoords.y);

        setTempAnnotation({
            ...tempAnnotation,
            x, y, width, height
        });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (isPanning) {
        setIsPanning(false);
        panOrigin.current = null;
        return;
    }
    if (draggingAnnotationId) {
        setDraggingAnnotationId(null);
        setDragStartOffset(null);
        return;
    }
    if (!isDrawing || !editingPageId || !tempAnnotation) {
        setIsDrawing(false);
        setTempAnnotation(null);
        return;
    }

    if (Math.abs(tempAnnotation.width) > 0.1 || Math.abs(tempAnnotation.height) > 0.1) {
        const finalAnnotation: Annotation = {
            ...tempAnnotation,
            id: Math.random().toString(36).substr(2, 9)
        };

        setPages(pages.map(p => 
            p.uniqueId === editingPageId ? { ...p, annotations: [...p.annotations, finalAnnotation] } : p
        ));
    }

    setIsDrawing(false);
    setTempAnnotation(null);
    setStartCoords(null);
  };

  const cancelPointer = () => {
    setIsPanning(false);
    panOrigin.current = null;
    setDraggingAnnotationId(null);
    setDragStartOffset(null);
    setIsDrawing(false);
    setTempAnnotation(null);
    setStartCoords(null);
  };

  // --- Logic ---
  const updateAnnotation = (pageId: string, annotationId: string, updates: Partial<Annotation>) => {
    setPages(prev => prev.map(p =>
      p.uniqueId === pageId 
        ? { ...p, annotations: p.annotations.map(a => {
            if (a.id !== annotationId) return a;
            const next = { ...a, ...updates };
            if (updates.fontFamily !== undefined || updates.fontSize !== undefined || updates.isBold !== undefined || updates.isItalic !== undefined) {
              next.sourceFont = undefined;
              next.textStyle = undefined;
              next.useSourceMetrics = false;
              next.baseline = (next.fontSize || 24) * 0.8;
            }
            return next;
          }) }
        : p
    ));
  };

  const deleteAnnotation = (pageId: string, annotationId: string) => {
    setPages(prev => prev.map(p =>
      p.uniqueId === pageId 
        ? { ...p, annotations: p.annotations.flatMap(a => a.id !== annotationId ? [a] : a.original ? [{ ...a, isDeleted: true }] : []) }
        : p
    ));
    if(selectedAnnotationId === annotationId) setSelectedAnnotationId(null);
  };

  const runSmartOcr = async (page: PdfPage) => {
    if (ocrLock.current) return;
    if (page.ocrComplete) {
      setDetectionStatus('Bu sayfada OCR tamamlandı; mevcut düzenlemeler korundu.');
      return;
    }
    ocrLock.current = true;
    setOcrProcessing(true);
    setDetectionStatus('Türkçe + İngilizce OCR hazırlanıyor…');
    try {
      // @ts-ignore
      const Tesseract = window.Tesseract;
      if(!Tesseract) throw new Error("Tesseract not loaded");
      
      const img = new Image();
      const ready = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Sayfa görüntüsü okunamadı.'));
      });
      img.src = page.preview;
      await ready;
      
      const { data } = await Tesseract.recognize(
        page.preview,
        'tur+eng',
        { logger: (m: any) => setDetectionStatus(`OCR: ${m.status} ${Math.round((m.progress || 0) * 100)}%`) }
      );
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      const detected = ocrAnnotations(data, canvas);
      setPages(prev => prev.map(p => {
        if (p.uniqueId !== page.uniqueId) return p;
        const additions = detected.filter(a => !p.annotations.some(b => b.source && overlapsOriginal(a, b)));
        return { ...p, ocrComplete: true, annotations: [...p.annotations, ...additions] };
      }));
      setDetectionStatus(`${detected.length} sözcük algılandı. Boyut, stil ve renkler tahminidir; özgün görüntü değişiklik yapılana kadar korunur.`);
      setActiveTool('cursor');
    } catch (e) {
      console.error(e);
      alert("OCR işlemi sırasında hata oluştu.");
    } finally {
      setOcrProcessing(false);
      ocrLock.current = false;
    }
  };

  const handleSave = async () => {
    if (sourceFiles.length === 0) return;
    setIsSaving(true);
    try {
      // @ts-ignore
      const { PDFDocument, degrees } = window.PDFLib;
      // @ts-ignore
      const fontkit = window.fontkit;

      const newPdfDoc = await PDFDocument.create();
      if (fontkit) newPdfDoc.registerFontkit(fontkit);

      const fonts = new Map<string, any>();

      const loadedDocs = await Promise.all(
        sourceFiles.map(async (file) => {
          const ab = await file.arrayBuffer();
          return await PDFDocument.load(ab);
        })
      );

      const activePages = pages.filter(p => !p.isDeleted);
      
      for (const p of activePages) {
        const sourceDoc = loadedDocs[p.sourceFileIndex];
        const [copiedPage] = await newPdfDoc.copyPages(sourceDoc, [p.originalPageIndex]);
        if (p.rotation !== 0) {
           const existingRotation = copiedPage.getRotation().angle;
           copiedPage.setRotation(degrees(existingRotation + p.rotation));
        }

        await drawPageEdits(newPdfDoc, copiedPage, p, fonts);
        newPdfDoc.addPage(copiedPage);
      }

      const pdfBytes = await newPdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `BelgePlus_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error(e);
      alert("PDF kaydedilirken bir hata oluştu: " + (e as any).message);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedAnnotation = editingPage?.annotations.find(a => a.id === selectedAnnotationId);

  // --- EDITOR VIEW (Full Screen) ---
  if (editingPage) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col overflow-hidden animate-in fade-in duration-300">
        {/* Modern Glass Toolbar - Scrollable on Mobile */}
        <div className="relative z-50 px-2 py-2 flex justify-center pointer-events-none shrink-0">
            <div className="bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/20 p-2 flex flex-col items-start md:items-center animate-in slide-in-from-top-4 ring-1 ring-black/10 max-w-full md:max-w-fit overflow-x-auto pointer-events-auto">
             
             <div className="flex w-full min-w-max space-x-2">
                 {/* Tabs */}
                 <div className="flex space-x-2 bg-slate-100/50 p-1 rounded-xl">
                     <button onClick={() => setActiveTab('edit')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'edit' ? 'bg-white shadow text-brand-600' : 'text-slate-500 hover:text-slate-800'}`}>Düzenle</button>
                     <button onClick={() => setActiveTab('insert')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'insert' ? 'bg-white shadow text-brand-600' : 'text-slate-500 hover:text-slate-800'}`}>Ekle</button>
                 </div>

                 {/* Tools Group based on Tab */}
                 {activeTab === 'edit' ? (
                     <div className="flex bg-slate-100/80 rounded-xl p-1.5 space-x-1">
                        {[
                        { id: 'cursor', icon: <MousePointerClick size={18} />, label: 'Seç' },
                        { id: 'hand', icon: <Hand size={18} />, label: 'Gezin' },
                        { id: 'text', icon: <Type size={18} />, label: 'Yazı' },
                        { id: 'highlight', icon: <Highlighter size={18} />, label: 'Vurgula' },
                        { id: 'line', icon: <Minus size={18} className="rotate-45" />, label: 'Çizgi' },
                        { id: 'erase', icon: <Eraser size={18} />, label: 'Sil' }
                        ].map(tool => (
                        <button 
                            key={tool.id}
                            onClick={() => setActiveTool(tool.id as any)} 
                            className={`p-2 rounded-lg transition-all relative group ${activeTool === tool.id ? 'bg-white shadow-sm text-brand-600 ring-1 ring-black/5 transform scale-105' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}
                            title={tool.label}
                        >
                            {tool.icon}
                        </button>
                        ))}
                     </div>
                 ) : (
                    <div className="flex bg-slate-100/80 rounded-xl p-1.5 space-x-2">
                        <button onClick={() => setShowQrModal(true)} className="p-2 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors" title="QR Ekle"><QrCode size={18}/></button>
                        <button onClick={() => setShowWatermarkModal(true)} className="p-2 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors" title="Filigran"><Stamp size={18}/></button>
                    </div>
                 )}
                 
                 {/* Selection Actions */}
                 {selectedAnnotation && (
                     <div className="flex items-center space-x-2 pl-2 border-l border-slate-200/50 animate-fade-in">
                        <button 
                            onClick={() => deleteAnnotation(editingPage.uniqueId, selectedAnnotation.id)}
                            className="p-2 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 rounded-xl transition-colors shadow-sm"
                            title="Seçili Öğeyi Sil"
                        >
                            <Trash2 size={18} />
                        </button>
                     </div>
                 )}

                 {/* OCR & Back */}
                 <div className="pl-2 border-l border-slate-200/50 flex items-center space-x-2">
                    <button 
                    onClick={() => setEditingPageId(null)} 
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 hover:text-slate-900 transition-colors"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button 
                    onClick={() => runSmartOcr(editingPage)} 
                    disabled={ocrProcessing || editingPage.ocrComplete}
                    className="bg-brand-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-2"
                    >
                    {ocrProcessing ? <Loader2 className="animate-spin" size={14} /> : <ScanText size={14} />}
                    <span>{editingPage.ocrComplete ? 'OCR hazır' : 'OCR (TR + EN)'}</span>
                    </button>
                    <input type="search" aria-label="Sayfa metninde ara" placeholder="Metinde ara"
                      value={textSearch} onChange={e => setTextSearch(e.target.value)}
                      className="w-28 rounded-lg border border-slate-200 p-2 text-xs" />
                 </div>
             </div>
             
             {/* Properties Row (Second Row on Mobile) */}
             {selectedAnnotation && selectedAnnotation.type === 'text' && (
                <div className="flex items-center space-x-2 mt-2 pt-2 border-t border-slate-100 w-full min-w-max">
                     <div className="h-8 bg-slate-100/80 rounded-lg flex items-center px-2">
                     <select 
                         value={selectedAnnotation.fontFamily || 'Helvetica'}
                         onChange={(e) => updateAnnotation(editingPage.uniqueId, selectedAnnotation.id, { fontFamily: e.target.value as any })}
                         className="bg-transparent text-slate-700 text-[10px] font-bold border-none focus:ring-0 cursor-pointer outline-none uppercase tracking-wide"
                     >
                         <option value="Helvetica">Sans (Noto)</option>
                         <option value="Times New Roman">Serif (Noto)</option>
                         <option value="Courier">Mono (Noto)</option>
                     </select>
                     </div>

                     <div className="flex items-center bg-slate-100/80 rounded-lg h-8 px-2">
                     <input 
                         type="number"
                         min={1}
                         max={500}
                         step={0.1}
                         value={Math.round((selectedAnnotation.fontSize || 24) * (editingPage.displayHeight || 1) / (editingPage.previewHeight || 2) * 10) / 10}
                         onChange={(e) => { const value = Number(e.target.value); if (Number.isFinite(value) && value > 0) updateAnnotation(editingPage.uniqueId, selectedAnnotation.id, { fontSize: value * (editingPage.previewHeight || 2) / (editingPage.displayHeight || 1) }); }}
                         className="w-8 bg-transparent border-none text-center text-xs font-bold focus:ring-0 p-0"
                     />
                     <span className="text-[10px] text-slate-400 ml-1 font-bold">pt</span>
                     </div>

                     <button 
                     onClick={() => updateAnnotation(editingPage.uniqueId, selectedAnnotation.id, { isBold: !selectedAnnotation.isBold })}
                     className={`h-8 w-8 flex items-center justify-center rounded-lg transition-all ${selectedAnnotation.isBold ? 'bg-slate-800 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                     >
                     <Bold size={14} />
                     </button>
                     <button
                       title="İtalik"
                       onClick={() => updateAnnotation(editingPage.uniqueId, selectedAnnotation.id, { isItalic: !selectedAnnotation.isItalic })}
                       className={`h-8 w-8 rounded-lg italic font-serif ${selectedAnnotation.isItalic ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}
                     >I</button>
                     {selectedAnnotation.source && <span className="text-[10px] text-slate-500 max-w-44 truncate" title={selectedAnnotation.detectedFont}>
                       {selectedAnnotation.source === 'native' ? 'PDF ölçüleri' : `OCR ~%${Math.round(selectedAnnotation.confidence || 0)}`} · stil tahmini
                     </span>}

                     <div className="relative group h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer shadow-inner border border-slate-200">
                     <div className="w-5 h-5 rounded-full border border-slate-200/50 shadow-sm" style={{ backgroundColor: selectedAnnotation.color || '#000000' }}></div>
                     <input 
                         type="color" 
                         value={selectedAnnotation.color || '#000000'}
                         onChange={(e) => updateAnnotation(editingPage.uniqueId, selectedAnnotation.id, { color: e.target.value })}
                         className="absolute inset-0 opacity-0 cursor-pointer"
                     />
                     </div>
                </div>
             )}
             <p role="status" aria-live="polite" className="text-[10px] text-slate-500 max-w-xl mt-1 whitespace-normal">
               {detectionStatus || 'Özgün görüntü korunur. Metne tıklayın; taşımak için seçili kutunun ok simgesini sürükleyin.'}
               {' '}Yazı tipi mümkünse korunur, aksi halde kaynak ölçülerine eşleştirilir; karmaşık arka planlar tam onarılamaz. Silme görsel kapatmadır, güvenli sansür değildir.
               {editingPage.rotation !== 0 && ` Ek ${editingPage.rotation}° sayfa dönüşü kaydetmede uygulanır; düzenleme kaynak yönündedir.`}
             </p>
            </div>
        </div>

        {/* Modals */}
        {showQrModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
                    <h3 className="font-bold text-lg mb-4">QR Kod Oluştur</h3>
                    <input autoFocus type="text" value={qrText} onChange={e => setQrText(e.target.value)} className="w-full border p-2 rounded-lg mb-4" placeholder="URL veya Metin girin..." />
                    <div className="flex justify-end space-x-2">
                        <button onClick={() => setShowQrModal(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">İptal</button>
                        <button onClick={addQrCode} className="px-4 py-2 bg-brand-600 text-white rounded-lg">Oluştur</button>
                    </div>
                </div>
            </div>
        )}

        {showWatermarkModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
                    <h3 className="font-bold text-lg mb-4">Filigran Ekle</h3>
                    <input autoFocus type="text" value={watermarkText} onChange={e => setWatermarkText(e.target.value)} className="w-full border p-2 rounded-lg mb-4" placeholder="Metin (Örn: TASLAK)" />
                    <div className="flex justify-end space-x-2">
                        <button onClick={() => setShowWatermarkModal(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">İptal</button>
                        <button onClick={applyWatermark} className="px-4 py-2 bg-brand-600 text-white rounded-lg">Uygula</button>
                    </div>
                </div>
            </div>
        )}

        {/* Canvas Area */}
        <div 
            ref={containerRef}
            className="flex-1 min-h-0 min-w-0 bg-slate-900 overflow-auto relative"
            style={{ touchAction: 'auto', overflowAnchor: 'none' }}
        >
           <div style={{
             width: (editingPage.previewWidth || 1) * zoomLevel / 100 + 48,
             height: (editingPage.previewHeight || 1) * zoomLevel / 100 + 48,
             minWidth: '100%', minHeight: '100%', padding: 24,
             display: 'grid', placeItems: 'center', boxSizing: 'border-box',
           }}>
           <div style={{ position: 'relative', width: (editingPage.previewWidth || 1) * zoomLevel / 100, height: (editingPage.previewHeight || 1) * zoomLevel / 100, overflow: 'hidden' }}>
           <div 
              ref={canvasRef} 
              className={`absolute top-0 left-0 bg-white origin-top-left ring-1 ring-white/10 ${isPanning ? 'cursor-grabbing' : (activeTool === 'hand' ? 'cursor-grab' : '')}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={cancelPointer}
              onLostPointerCapture={cancelPointer}
              style={{ 
                width: editingPage.previewWidth,
                height: editingPage.previewHeight,
                transform: `scale(${zoomLevel / 100})`,
                touchAction: activeTool === 'hand' || (activeTool === 'cursor' && !draggingAnnotationId) ? 'auto' : 'none' 
              }}
           >
              <img 
                ref={imageRef}
                src={editingPage.preview} 
                alt="Page" 
                className="max-w-none select-none pointer-events-none"
                style={{ display: 'block' }}
                draggable={false}
              />
              
              {tempAnnotation && (
                 <div className="absolute border-2 border-brand-500 border-dashed z-50 pointer-events-none"
                      style={{
                          left: `${activeTool === 'line' ? tempAnnotation.x : tempAnnotation.x}%`, 
                          top: `${activeTool === 'line' ? tempAnnotation.y : tempAnnotation.y}%`,
                          width: `${activeTool === 'line' ? tempAnnotation.width : tempAnnotation.width}%`,
                          height: `${activeTool === 'line' ? tempAnnotation.height : tempAnnotation.height}%`,
                      }}
                 ></div>
              )}

              {editingPage.annotations.filter(ann => ann.original && textChanged(ann)).map(ann => {
                const mask = originalMaskBounds(ann, editingPage.previewWidth || 1, editingPage.previewHeight || 1);
                return <div key={`mask-${ann.id}`} className="absolute pointer-events-none z-10" style={{
                  left: `${mask.x}%`, top: `${mask.y}%`,
                  width: `${mask.width}%`, height: `${mask.height}%`,
                  backgroundColor: ann.maskColor || '#ffffff',
                  transform: `rotate(${mask.rotation || 0}deg)`, transformOrigin: 'top left',
                }} />;
              })}
              {editingPage.annotations.filter(ann => !ann.isDeleted).map(ann => {
                const isSelected = selectedAnnotationId === ann.id;
                
                if (ann.type === 'line') {
                    return (
                        <div key={ann.id} className="absolute inset-0 pointer-events-none z-20">
                           <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                              <line 
                                x1={`${ann.x}%`} 
                                y1={`${ann.y}%`} 
                                x2={`${ann.x + ann.width}%`} 
                                y2={`${ann.y + ann.height}%`} 
                                stroke={ann.color || 'black'} 
                                strokeWidth={ann.lineWidth || 3}
                                strokeLinecap="round"
                                className="pointer-events-auto cursor-pointer hover:opacity-70"
                                onClick={(e) => { e.stopPropagation(); setSelectedAnnotationId(ann.id); }}
                              />
                           </svg>
                           {isSelected && (
                               <button 
                                  onClick={(e) => { e.stopPropagation(); deleteAnnotation(editingPage.uniqueId, ann.id); }}
                                  className="absolute bg-red-500 text-white rounded-full p-1.5 z-50 pointer-events-auto shadow-md transform -translate-x-1/2 -translate-y-1/2"
                                  style={{ left: `${ann.x + ann.width}%`, top: `${ann.y + ann.height}%` }}
                               >
                                  <X size={14} />
                               </button>
                           )}
                        </div>
                    )
                }
                
                const shouldShowText = textChanged(ann);
                const layout = ann.type === 'text' ? textLayout(ann, editingPage) : null;

                return (
                  <div
                    key={ann.id}
                    className={`absolute ${activeTool === 'cursor' ? 'cursor-pointer' : ''} ${textSearch && ann.content?.toLocaleLowerCase('tr').includes(textSearch.toLocaleLowerCase('tr')) ? 'outline outline-2 outline-amber-400' : ''} ${isSelected ? 'ring-2 ring-brand-500 ring-offset-1 z-[50]' : (ann.type === 'text' && ann.isInteractive ? 'hover:bg-white/30 z-[40]' : 'z-[20]')}`}
                    style={{
                      left: `${ann.x}%`,
                      top: `${ann.y}%`,
                      width: layout && (isSelected || shouldShowText) ? layout.width : `${ann.width}%`,
                      height: layout && (isSelected || shouldShowText) ? layout.height : `${ann.height}%`,
                      backgroundColor: ann.type === 'erase' ? 'white' : (ann.type === 'highlight' ? ann.color : (ann.textBackgroundColor || ann.backgroundColor || 'transparent')),
                      opacity: ann.type === 'highlight' ? (ann.opacity || 0.4) : (ann.opacity || 1),
                      mixBlendMode: ann.type === 'highlight' ? 'multiply' : 'normal',
                      transition: draggingAnnotationId === ann.id ? 'none' : 'background-color 0.2s',
                      transform: `rotate(${ann.rotation || 0}deg)`,
                      transformOrigin: 'top left',
                    }}
                    onPointerDown={(e) => {
                       if (activeTool === 'cursor') {
                          e.stopPropagation();
                          if (e.pointerType === 'touch') return;
                          e.preventDefault();
                          e.currentTarget.setPointerCapture(e.pointerId);
                          
                          setSelectedAnnotationId(ann.id);
                          const rect = canvasRef.current?.getBoundingClientRect();
                          if(rect) {
                             const clientX = ((e.clientX - rect.left) / rect.width) * 100;
                             const clientY = ((e.clientY - rect.top) / rect.height) * 100;
                             setDraggingAnnotationId(ann.id);
                             setDragStartOffset({ x: clientX - ann.x, y: clientY - ann.y });
                          }
                       }
                    }}
                  >
                    {ann.type === 'image' && ann.imageData && (
                        <div className="w-full h-full relative group">
                            <img src={ann.imageData} className="w-full h-full object-contain pointer-events-none"/>
                             {isSelected && (
                               <button title="Metni taşı" aria-label="Metni taşı" className="absolute -top-5 left-0 bg-brand-600 text-white p-1 z-30 cursor-move"><MousePointer2 size={12} /></button>
                             )}
                             {isSelected && (
                                <button 
                                    onPointerDown={(e) => { e.stopPropagation(); deleteAnnotation(editingPage.uniqueId, ann.id); }}
                                    className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 z-30 hover:scale-110 shadow-sm transition-transform"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    )}
                    
                    {ann.type === 'text' && (
                      <div className="relative w-full h-full group pointer-events-auto">
                         {isSelected && (
                           <button title="Metni taşı" aria-label="Metni taşı" className="absolute -top-5 left-0 bg-brand-600 text-white p-1 z-30 cursor-move"><MousePointer2 size={12} /></button>
                         )}
                         {isSelected && (
                           <button 
                              onPointerDown={(e) => { e.stopPropagation(); deleteAnnotation(editingPage.uniqueId, ann.id); }}
                              className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 z-30 shadow-sm transition-transform"
                           >
                              <X size={12} />
                           </button>
                         )}
                         {shouldShowText && (
                           <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%" style={{ overflow: 'visible' }}>
                             <text x="0" y={layout!.baseline}
                               transform={`scale(${layout!.scaleX} 1)`}
                               fill={ann.color || '#000000'} fontSize={layout!.size}
                               fontStyle={textFontStyle(ann)}
                               fontFamily={`${editingFontName(ann)}, ${ann.fontFamily === 'Courier' ? 'monospace' : ann.fontFamily === 'Times New Roman' ? 'serif' : 'sans-serif'}`}
                               style={{ whiteSpace: 'pre' }}>
                               {(ann.content || '').replace(/\r/g, '').split('\n').map((line, index) =>
                                 <tspan key={index} x="0" dy={index ? layout!.size * 1.2 : 0}>{line}</tspan>
                               )}
                             </text>
                           </svg>
                         )}
                         <textarea
                            aria-label={`Metin düzenle: ${ann.content || 'boş'}`}
                            wrap="off"
                            value={ann.content}
                            onPointerDown={e => {
                              if (activeTool !== 'cursor') return;
                              e.stopPropagation();
                              setSelectedAnnotationId(ann.id);
                            }}
                            onChange={(e) => updateAnnotation(editingPage.uniqueId, ann.id, { content: e.target.value })}
                            className={`w-full h-full resize-none focus:outline-none p-0 m-0 border-none overflow-hidden whitespace-pre-wrap leading-tight selection:bg-brand-200 ${!isSelected && ann.isInteractive ? 'text-transparent selection:text-transparent cursor-text' : ''}`}
                            style={{ 
                              fontSize: layout!.size,
                              fontFamily: editingFontName(ann),
                              fontStyle: textFontStyle(ann),
                              color: 'transparent',
                              position: 'absolute', top: layout!.baselineOffset,
                              width: layout!.width / layout!.scaleX,
                              height: layout!.height + Math.abs(layout!.baselineOffset),
                              transform: `scaleX(${layout!.scaleX})`, transformOrigin: 'top left',
                              pointerEvents: activeTool === 'cursor' ? 'auto' : 'none',
                              caretColor: ann.color || '#000000',
                              padding: 0, margin: 0, border: 0, borderRadius: 0,
                              boxShadow: 'none', boxSizing: 'border-box',
                              backgroundColor: 'transparent',
                              lineHeight: 1.2,
                            }}
                            spellCheck={false}
                            disabled={activeTool !== 'cursor'}
                         />
                      </div>
                    )}
                  </div>
                );
              })}
           </div>
           </div>
           </div>
        </div>
        <div className="shrink-0 flex justify-center py-2 bg-slate-900 z-[60]">
          <div className="flex items-center bg-slate-800 rounded-full p-1.5 shadow-xl border border-white/10">
            <button aria-label="Uzaklaştır" onClick={() => setZoomLevel(z => Math.max(z - 10, 20))} className="p-2 hover:bg-white/10 rounded-full text-white"><ZoomOut size={18} /></button>
            <span className="text-xs font-mono font-bold text-white w-10 text-center select-none">{zoomLevel}%</span>
            <button aria-label="Yakınlaştır" onClick={() => setZoomLevel(z => Math.min(z + 10, 400))} className="p-2 hover:bg-white/10 rounded-full text-white"><ZoomIn size={18} /></button>
          </div>
        </div>
      </div>
    );
  }

  // Gallery View
  return (
    <div className="max-w-full mx-auto flex flex-col p-4 md:p-8 animate-fade-in w-full md:px-12">
       <SectionHeader title="Editör+" description="PDF belgelerinizi düzenleyin, imzalayın." onBack={onBack} />

       <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 shrink-0 space-y-4 md:space-y-0">
          <div className="flex space-x-3 w-full">
             <button onClick={() => fileInputRef.current?.click()} className="flex-1 md:flex-none flex items-center justify-center bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-2xl font-bold hover:bg-slate-50 transition-colors shadow-sm hover:shadow-md">
                <Plus size={20} className="mr-2" /> Sayfa Ekle
             </button>
             <div className="hidden md:block flex-1"></div>
             <button 
                onClick={handleSave} 
                disabled={pages.length === 0 || isSaving || isProcessing || ocrProcessing || pages.every(p => p.isDeleted)}
                className="flex-1 md:flex-none flex items-center justify-center bg-brand-600 text-white px-10 py-4 rounded-2xl font-bold hover:bg-brand-700 transition-all shadow-xl shadow-brand-500/30 disabled:opacity-50 transform active:scale-95"
             >
                {isSaving ? <Loader2 className="animate-spin mr-2" size={20} /> : <Save size={20} className="mr-2" />}
                PDF Kaydet
             </button>
          </div>
          <input 
             type="file" 
             ref={fileInputRef} 
             onChange={(e) => { if(e.target.files && e.target.files.length > 0) handleInitialUpload(e.target.files) }} 
             className="hidden" 
             accept=".pdf" 
             multiple 
          />
       </div>

       {detectionStatus && <p role="status" className="text-sm text-slate-600 mb-4">{detectionStatus}</p>}
       {pages.length === 0 ? (
          <div className="flex-1 border-4 border-dashed border-slate-200 rounded-[2rem] md:rounded-[2.5rem] flex flex-col items-center justify-center bg-slate-50/50 hover:bg-white hover:border-brand-400 transition-all duration-300 cursor-pointer py-16 md:py-32 group" onClick={() => fileInputRef.current?.click()}>
             <div className="w-20 h-20 md:w-28 md:h-28 bg-white rounded-3xl flex items-center justify-center mb-6 md:mb-8 text-slate-300 group-hover:text-brand-500 group-hover:scale-110 group-hover:rotate-3 transition-all shadow-lg">
                <FilePenLine className="w-10 h-10 md:w-14 md:h-14" />
             </div>
             <h3 className="text-xl md:text-3xl font-bold text-slate-700 mb-2 md:mb-3">Başlamak İçin PDF Seçin</h3>
             <p className="text-slate-400 font-medium text-sm md:text-lg">Sürükleyip bırakabilir veya tıklayabilirsiniz</p>
          </div>
       ) : (
          <div className="bg-slate-100/50 rounded-3xl p-4 md:p-10 border border-slate-200 min-h-[400px] md:min-h-[600px] animate-slide-up">
             {isProcessing && (
               <div className="mb-8 bg-brand-50 text-brand-700 p-6 rounded-2xl flex items-center justify-center animate-pulse border border-brand-100 shadow-sm">
                 <Loader2 className="animate-spin mr-3" size={24} /> <span className="font-bold text-lg">Sayfalar işleniyor...</span>
               </div>
             )}
             
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 md:gap-8">
                {pages.map((page, idx) => (
                   <div key={page.uniqueId} className={`relative group transition-all duration-300 ${page.isDeleted ? 'opacity-40 grayscale scale-95' : 'hover:scale-105 hover:-translate-y-2'}`}>
                      <div className="absolute -top-3 -left-3 z-20 bg-slate-800 text-white text-sm font-bold w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full shadow-xl ring-4 ring-white">
                        {page.originalPageIndex + 1}
                      </div>
                      
                      {/* Hover Actions - Visible on click for mobile */}
                      <div className="absolute top-3 right-3 flex flex-col space-y-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity z-20">
                         <button onClick={() => handleRotate(page.uniqueId)} className="bg-white p-2 md:p-2.5 rounded-xl shadow-lg hover:bg-brand-50 hover:text-brand-600 text-slate-500 transition-colors" title="Döndür">
                            <RotateCw size={18} />
                         </button>
                         <button onClick={() => handleDelete(page.uniqueId)} className="bg-white p-2 md:p-2.5 rounded-xl shadow-lg hover:bg-red-50 hover:text-red-600 text-slate-500 transition-colors" title={page.isDeleted ? "Geri Al" : "Sil"}>
                            <Trash2 size={18} />
                         </button>
                      </div>

                      {/* Main Edit Button */}
                      {!page.isDeleted && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/10 rounded-2xl backdrop-blur-[2px] pointer-events-none">
                            <button 
                              onClick={() => setEditingPageId(page.uniqueId)}
                              className="bg-brand-600 text-white px-6 py-2 md:px-8 md:py-3 rounded-full shadow-2xl font-extrabold text-xs md:text-sm flex items-center pointer-events-auto transform hover:scale-105 transition-all hover:bg-brand-700 tracking-wider"
                            >
                              <FilePenLine size={16} className="mr-2" /> DÜZENLE
                            </button>
                        </div>
                      )}

                      <div 
                        className={`bg-white rounded-2xl shadow-md border overflow-hidden ${page.isDeleted ? 'border-red-200 bg-red-50' : 'border-slate-200 group-hover:border-brand-300 group-hover:shadow-2xl'}`}
                        style={{ aspectRatio: '210/297' }}
                      >
                         <img 
                            src={page.preview} 
                            alt={`Page ${idx}`} 
                            className="w-full h-full object-contain"
                            style={{ transform: `rotate(${page.rotation}deg)` }} 
                         />
                      </div>
                   </div>
                ))}
             </div>
          </div>
       )}
    </div>
  );
};