import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Download, FileText, ArrowRight, Loader2, CheckCircle2, RotateCw, Trash2, Save, Plus, ScanText, FilePenLine, MousePointer2, Eraser, Type, ChevronLeft, ZoomIn, ZoomOut, Bold, Palette, Highlighter, Minus, Home, Sparkles, Percent, Hand, MousePointerClick, GitCompare, Stamp, QrCode, Grid, Type as TypeIcon, Copy, FileDiff } from 'lucide-react';
import { FileWithPreview, CompressedResult, PdfPage, Annotation } from '../types';

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
            const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
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
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
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

export { default as PdfEditorFeature } from './pdf/PdfEditor';
