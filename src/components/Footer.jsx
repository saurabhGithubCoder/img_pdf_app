import React from 'react';
import { Layers, Heart, Coffee, ShieldCheck, ExternalLink } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand & Mission */}
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center shadow-md">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-black tracking-tight text-white">
                PDF<span className="text-rose-500">Forge</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md">
              A free, open-source suite for fast document conversion and manipulation. While some heavy operations run ephemeral server tasks, files are never stored or logged. Your privacy remains 100% protected.
            </p>
            <div className="flex items-center space-x-2 text-xs text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Zero data retention guarantee</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Quick Tools</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><a href="#merge" className="hover:text-rose-400 transition">Merge & Split PDF</a></li>
              <li><a href="#compress" className="hover:text-rose-400 transition">Compress PDF</a></li>
              <li><a href="#convert" className="hover:text-rose-400 transition">PDF to Word & Excel</a></li>
              <li><a href="#organize" className="hover:text-rose-400 transition">Visual Page Organizer</a></li>
            </ul>
          </div>

          {/* Developer & Support */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Support the Project</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Crafted with <Heart className="w-3.5 h-3.5 inline text-rose-500 fill-rose-500 mx-0.5" /> by <strong className="text-white">Saurabh Panchal</strong>.
            </p>
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition shadow-md"
            >
              <Coffee className="w-4 h-4" />
              <span>Buy Me a Coffee</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} PDFForge. Open-source under MIT License.</p>
          <div className="flex items-center space-x-6">
            <a
              href="https://github.com/saurabhpan98/pdf-forge"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-400 flex items-center space-x-1.5 transition"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>GitHub</span>
            </a>
            <span className="hover:text-slate-400 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-400 cursor-pointer">Terms of Service</span>
          </div>
        </div>
      </div>
    </footer>
  );
}