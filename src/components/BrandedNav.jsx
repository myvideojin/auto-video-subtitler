import React from 'react';
import { ExternalLink, Star, Sparkles } from 'lucide-react';

export default function BrandedNav() {
  return (
    <header className="w-full bg-[#030816]/90 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 font-black text-white text-base">
            VJ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white tracking-tight">Auto Video Subtitler</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full hidden sm:inline-block">
                Open Source
              </span>
            </div>
            <p className="text-[11px] text-gray-400">Powered by VideoJin.com</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://github.com/myvideojin/auto-video-subtitler"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
          >
            <Star size={14} className="text-amber-400 fill-amber-400" />
            <span className="hidden sm:inline">Star on</span> GitHub
          </a>
          <a
            href="https://videojin.com/auto-subtitler"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg shadow-md shadow-blue-600/20 transition-all hover:scale-[1.02]"
          >
            <Sparkles size={14} />
            <span>Full Suite on Videojin.com</span>
            <ExternalLink size={12} className="opacity-80" />
          </a>
        </div>
      </div>
    </header>
  );
}
