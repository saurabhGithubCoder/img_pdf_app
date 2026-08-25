import React, { useState, useMemo } from 'react';
import Header from './components/Header';
import ToolCard from './components/ToolCard';
import ToolModal from './components/ToolModal';
import { PDF_CATEGORIES } from './data/pdfTools';
import { Search } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased">
      <Header />

      {/* Hero Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
          Every tool you need to work with PDFs
        </h1>
        <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
          All document processing happens locally in your browser. No files are uploaded to any server.
        </p>

        {/* Search Bar */}
        <div className="mt-8 max-w-xl mx-auto relative">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search any PDF tool (e.g. Merge, Compress, AI Summarizer)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition text-sm text-slate-800 placeholder-slate-400"
          />
        </div>
      </section>

      {/* Grid Suite */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 space-y-12">
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

      {/* Action Modal */}
      {activeTool && (
        <ToolModal tool={activeTool} onClose={() => setActiveTool(null)} />
      )}
    </div>
  );
}