import React from 'react';
import { AppMode } from '../types';
import { LayoutDashboard, FileImage, FileType, Zap, FilePenLine } from 'lucide-react';

interface SidebarProps {
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
  collapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentMode, setMode, collapsed = false }) => {
  const menuItems = [
    { mode: AppMode.HOME, label: 'Panel', icon: <LayoutDashboard size={20} /> },
    { mode: AppMode.COMPRESSOR, label: 'Sıkıştırıcı', icon: <FileImage size={20} /> },
    { mode: AppMode.CONVERTER, label: 'Dönüştürücü', icon: <FileType size={20} /> },
    { mode: AppMode.PDF_EDITOR, label: 'Editör+', icon: <FilePenLine size={20} /> },
  ];

  return (
    <aside 
      className={`bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 shadow-xl z-50 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${collapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-64 opacity-100'}`}
    >
      <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
        <Zap className="text-brand-500 shrink-0" size={32} />
        <div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-brand-400 to-blue-200 bg-clip-text text-transparent">BelgeEditor+</h1>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 mt-4">
        {menuItems.map((item) => (
          <button
            key={item.mode}
            onClick={() => setMode(item.mode)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              currentMode === item.mode
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/50'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-400">
          <p className="font-semibold text-slate-300 mb-1">Güvenlik:</p>
          Tüm işlemler tarayıcınızda yapılır. Sunucuya veri gönderilmez.
        </div>
      </div>
    </aside>
  );
};