import React, { useState, useMemo } from 'react';
import Header from './components/Header';
import ToolCard from './components/ToolCard';
import ToolModal from './components/ToolModal';
import Reviews from './components/Reviews';
import Footer from './components/Footer';
import { PDF_CATEGORIES } from './data/pdfTools';
import { Search, ShieldCheck, Lock, Sparkles, Server } from 'lucide-react';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTool, setActiveTool] = useState(null);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return PDF_CATEGORIES;
    const query = searchQuery.toLowerCase();
    return PDF_CATEGORIES.map((category) => ({
      ...category,
      tools: category.tools.filter(
        (tool) =>
          tool.name.toLowerCase().includes(query) ||
          tool.desc.toLowerCase().includes(query)
      ),
    })).filter((category) => category.tools.length > 0);
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased flex flex-col justify-between">
      <div>
        <Header onSelectTool={(tool) => setActiveTool(tool)} />

        {/* Hero Section */}
        <section className="py-14 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-rose-50 border border-rose-200 text-rose-600 rounded-full text-xs font-bold mb-4 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Complete PDF & Office Utility Suite</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
            Every tool you need to work with <span className="text-rose-500">PDFs</span>
          </h1>

          <p className="mt-4 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Fast, secure, and open-source. For tools requiring server-level conversion engines, files are processed ephemerally and never saved to any database.
          </p>

          {/* Privacy Notice Pill */}
          <div className="mt-4 inline-flex items-center space-x-2 text-xs text-slate-500 bg-white border border-slate-200 px-4 py-1.5 rounded-full shadow-sm">
            <Server className="w-3.5 h-3.5 text-blue-500" />
            <span>Ephemeral In-Memory Processing</span>
            <span className="text-slate-300">•</span>
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            <span>No Files Stored</span>
          </div>

          {/* Search Bar */}
          <div className="mt-8 max-w-xl mx-auto relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search any tool (e.g. Merge, Compress, Word to PDF, Rotate)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition text-sm text-slate-800 placeholder-slate-400"
            />
          </div>
        </section>

        {/* Grid Suite */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-12">
          {filteredCategories.map((category) => (
            <div key={category.title} className="space-y-4">
              <div className="flex items-center space-x-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {category.title}
                </h2>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {category.tools.map((tool) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    onSelect={(selected) => setActiveTool(selected)}
                  />
                ))}
              </div>
            </div>
          ))}
        </main>

        {/* Customer Reviews Section */}
        <Reviews />
      </div>

      {/* Footer */}
      <Footer />

      {/* Action Modal */}
      {activeTool && (
        <ToolModal tool={activeTool} onClose={() => setActiveTool(null)} />
      )}
    </div>
  );
}