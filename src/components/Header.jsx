import React, { useState, useRef, useEffect } from 'react';
import { Layers, ChevronDown, ShieldCheck, Sparkles } from 'lucide-react';
import { PDF_CATEGORIES } from '../data/pdfTools';

export default function Header({ onSelectTool }) {
  const [openDropdown, setOpenDropdown] = useState(null);
  const navRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200" ref={navRef}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center shadow-md shadow-rose-500/20">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-black tracking-tight text-slate-900">
            PDF<span className="text-rose-500">Forge</span>
          </span>
        </div>

        {/* Quick Tools Dropdown Menu */}
        <nav className="hidden md:flex items-center space-x-1">
          {PDF_CATEGORIES.slice(0, 4).map((category) => (
            <div key={category.title} className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === category.title ? null : category.title)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition ${
                  openDropdown === category.title
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>{category.title}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {openDropdown === category.title && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  {category.tools.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => {
                        if (!tool.inactive) {
                          onSelectTool(tool);
                          setOpenDropdown(null);
                        }
                      }}
                      disabled={tool.inactive}
                      className={`w-full px-4 py-2 text-left flex items-center justify-between text-xs transition ${
                        tool.inactive
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-slate-50 text-slate-700 hover:text-rose-600'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 truncate">
                        <tool.icon className={`w-4 h-4 shrink-0 ${tool.color}`} />
                        <span className="font-medium truncate">{tool.name}</span>
                      </div>
                      {tool.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                          {tool.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Security & Open Source Badge */}
        <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="hidden sm:inline">100% Free & Open-Source</span>
          <span className="sm:hidden">Free & Secure</span>
        </div>
      </div>
    </header>
  );
}