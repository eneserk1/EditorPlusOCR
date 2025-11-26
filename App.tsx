import React, { useState, useRef } from 'react';
import { CompressorFeature, ConverterFeature, PdfEditorFeature, PdfComparatorFeature, MergeEditorFeature } from './components/Features';
import { AppMode } from './types';
import { Upload, FileText, Image as ImageIcon, FileType, Zap, PenTool, GitCompare, ShieldCheck, Lock, WifiOff, FileDiff } from 'lucide-react';

export default function App() {
  const [activeMode, setActiveMode] = useState<AppMode>(AppMode.HOME);

  const handleActionSelect = (mode: AppMode) => {
    setActiveMode(mode);
  };

  const renderContent = () => {
    switch (activeMode) {
      case AppMode.COMPRESSOR:
        return <CompressorFeature initialFiles={[]} onBack={() => { setActiveMode(AppMode.HOME); }} />;
      case AppMode.CONVERTER:
        return <ConverterFeature initialFiles={[]} onBack={() => { setActiveMode(AppMode.HOME); }} />;
      case AppMode.PDF_EDITOR:
        return <PdfEditorFeature initialFiles={[]} onBack={() => { setActiveMode(AppMode.HOME); }} />;
      case AppMode.COMPARE:
        return <PdfComparatorFeature initialFiles={[]} onBack={() => { setActiveMode(AppMode.HOME); }} />;
      case AppMode.TEXT_COMPARE:
        return <MergeEditorFeature onBack={() => setActiveMode(AppMode.HOME)} />;
      default:
        return renderHome();
    }
  };

  const renderHome = () => (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-white">
       {/* LEFT SIDE: Info & Onboarding */}
       <div className="w-full md:w-5/12 lg:w-4/12 bg-slate-900 text-white p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
          {/* Background FX */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/20 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/20 blur-3xl rounded-full translate-y-1/2 -translate-x-1/2"></div>

          <div className="relative z-10">
              <div className="flex items-center space-x-3 mb-8">
                  <div className="bg-brand-500 p-2.5 rounded-xl">
                    <Zap className="text-white w-6 h-6" fill="currentColor"/>
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight">BelgeEditor+</h1>
              </div>
              
              <div className="space-y-8 animate-slide-up">
                  <div className="space-y-2">
                      <h2 className="text-4xl md:text-5xl font-extrabold leading-tight">
                        Güvenli & <br/>
                        <span className="text-brand-400">Local</span> Çözüm.
                      </h2>
                      <p className="text-slate-400 text-lg">Kurumsal belgeleriniz tarayıcınızdan asla çıkmaz.</p>
                  </div>

                  <div className="space-y-6 pt-4">
                      <div className="flex items-start space-x-4">
                          <div className="bg-slate-800 p-3 rounded-xl text-brand-400 shrink-0">
                              <WifiOff size={24} />
                          </div>
                          <div>
                              <h3 className="font-bold text-lg">Tamamen Çevrimdışı</h3>
                              <p className="text-slate-400 text-sm">İnternet bağlantısı olmadan da çalışır. Sunucuya yükleme yok.</p>
                          </div>
                      </div>
                      <div className="flex items-start space-x-4">
                          <div className="bg-slate-800 p-3 rounded-xl text-orange-400 shrink-0">
                              <PenTool size={24} />
                          </div>
                          <div>
                              <h3 className="font-bold text-lg">Gelişmiş PDF Editörü</h3>
                              <p className="text-slate-400 text-sm">OCR, İmza, Silme ve Düzenleme özellikleri bir arada.</p>
                          </div>
                      </div>
                      <div className="flex items-start space-x-4">
                          <div className="bg-slate-800 p-3 rounded-xl text-green-400 shrink-0">
                              <ShieldCheck size={24} />
                          </div>
                          <div>
                              <h3 className="font-bold text-lg">Kurumsal Güvenlik</h3>
                              <p className="text-slate-400 text-sm">Gizli belgeleriniz güvende. Veriler sadece sizin cihazınızda işlenir.</p>
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          <div className="relative z-10 pt-8">
              <p className="text-xs text-slate-500">© {new Date().getFullYear()} BelgeEditor+. Tüm hakları saklıdır.</p>
          </div>
       </div>

       {/* RIGHT SIDE: Tool Selection */}
       <div className="w-full md:w-7/12 lg:w-8/12 bg-slate-50 relative flex flex-col items-center justify-center p-6 md:p-12 overflow-y-auto">
           {/* Grid Pattern Background */}
           <div className="absolute inset-0 bg-grid-pattern opacity-50 pointer-events-none"></div>

            <div className="w-full max-w-5xl animate-slide-up relative z-10">
                <div className="text-center mb-12">
                    <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">Ne yapmak istersiniz?</h2>
                    <p className="text-slate-500 text-lg max-w-2xl mx-auto">Tüm araçlar verilerinizi cihazınızda işler. %100 güvenli ve gizlidir.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    {[
                        { mode: AppMode.PDF_EDITOR, icon: PenTool, color: 'text-orange-600', bg: 'bg-orange-100', border: 'hover:border-orange-300', title: 'Editör+', desc: 'Düzenle, İmzala, OCR' },
                        { mode: AppMode.COMPRESSOR, icon: FileType, color: 'text-blue-600', bg: 'bg-blue-100', border: 'hover:border-blue-300', title: 'Sıkıştırıcı', desc: 'PDF, Görüntü, PPTX' },
                        { mode: AppMode.CONVERTER, icon: ImageIcon, color: 'text-indigo-600', bg: 'bg-indigo-100', border: 'hover:border-indigo-300', title: 'Dönüştürücü', desc: 'Görselden PDF\'e' },
                        { mode: AppMode.COMPARE, icon: GitCompare, color: 'text-purple-600', bg: 'bg-purple-100', border: 'hover:border-purple-300', title: 'PDF Karşılaştır', desc: 'Görsel fark analizi' },
                        { mode: AppMode.TEXT_COMPARE, icon: FileDiff, color: 'text-teal-600', bg: 'bg-teal-100', border: 'hover:border-teal-300', title: 'Merge Editör', desc: 'Metin farklarını birleştirin' },
                    ].map((item) => (
                        <button 
                            key={item.title}
                            onClick={() => item.mode && handleActionSelect(item.mode as AppMode)}
                            disabled={!item.mode}
                            className={`flex flex-col items-center p-8 rounded-[2rem] border-2 ${!item.mode ? 'border-slate-200 cursor-not-allowed' : `border-slate-100 ${item.border} hover:bg-white`} hover:shadow-xl transition-all duration-300 group text-center h-full bg-slate-50/50 disabled:opacity-70`}
                        >
                            <div className={`w-20 h-20 ${item.bg} ${item.color} rounded-3xl flex items-center justify-center mb-6 ${item.mode ? 'group-hover:scale-110 group-hover:rotate-3' : ''} transition-transform shadow-sm`}>
                                <item.icon className="w-10 h-10" />
                            </div>
                            <h4 className="font-bold text-slate-900 text-xl mb-2">{item.title}</h4>
                            <p className="text-sm text-slate-500 font-medium">{item.desc}</p>
                        </button>
                    ))}
                </div>
            </div>
       </div>
    </div>
  );

  return (
    <div className="min-h-screen font-sans selection:bg-brand-200 selection:text-brand-900 overflow-hidden">
      {renderContent()}
    </div>
  );
}
