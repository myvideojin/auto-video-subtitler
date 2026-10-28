import React from 'react';
import { ShieldCheck, Heart } from 'lucide-react';

export default function BrandedFooter() {
  return (
    <footer className="w-full border-t border-white/10 bg-[#020617] mt-24 py-12 px-4 text-center text-sm text-gray-400">
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-full">
          <ShieldCheck size={16} />
          <span>100% Client-Side Privacy: Videos are processed in your browser and never leave your machine.</span>
        </div>
        <p className="flex items-center justify-center gap-1.5 text-gray-400">
          Crafted with <Heart size={14} className="text-red-500 fill-red-500" /> by the team at 
          <a href="https://videojin.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline font-bold">
            Videojin.com
          </a>
        </p>
        <p className="text-xs text-gray-500">
          Check out our comprehensive AI media suite including deepfake detection, speech subtitling, silence removal, and forensic video analysis.
        </p>
        <div className="flex gap-4 text-xs text-gray-400 mt-2">
          <a href="https://videojin.com/auto-subtitler" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Parent Tool Page</a>
          <span>•</span>
          <a href="https://videojin.com/api-docs" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">API Docs</a>
          <span>•</span>
          <a href="https://videojin.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Privacy Protocol</a>
        </div>
      </div>
    </footer>
  );
}
