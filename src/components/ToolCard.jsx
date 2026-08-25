import React from 'react';

export default function ToolCard({ tool, onSelect }) {
  const IconComponent = tool.icon;

  return (
    <button
      onClick={() => onSelect(tool)}
      className="group relative text-left bg-white p-5 rounded-2xl border border-slate-200/80 hover:border-slate-300 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
    >
      <div>
        <div className={`w-11 h-11 rounded-xl ${tool.bg} ${tool.color} flex items-center justify-center mb-4 transition-transform group-hover:scale-105`}>
          <IconComponent className="w-5 h-5" />
        </div>
        <h3 className="font-semibold text-slate-900 group-hover:text-rose-600 transition-colors">
          {tool.name}
        </h3>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
          {tool.desc}
        </p>
      </div>
    </button>
  );
}