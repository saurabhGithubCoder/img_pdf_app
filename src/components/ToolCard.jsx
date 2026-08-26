import React from 'react';

export default function ToolCard({ tool, onSelect }) {
  const IconComponent = tool.icon;
  const isInactive = tool.inactive;

  return (
    <button
      onClick={() => !isInactive && onSelect(tool)}
      disabled={isInactive}
      className={`group relative text-left bg-white p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
        isInactive
          ? 'opacity-65 cursor-not-allowed border-slate-200 bg-slate-50/50'
          : 'border-slate-200/80 hover:border-slate-300 shadow-sm hover:shadow-md cursor-pointer'
      }`}
    >
      {/* Dynamic Badge */}
      {tool.badge && (
        <span
          className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full ${
            tool.badge === 'Coming Soon'
              ? 'bg-slate-100 text-slate-600 border border-slate-200'
              : tool.badge === '90% Accurate'
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}
        >
          {tool.badge}
        </span>
      )}

      <div>
        <div
          className={`w-11 h-11 rounded-xl ${tool.bg} ${tool.color} flex items-center justify-center mb-4 transition-transform ${
            !isInactive ? 'group-hover:scale-105' : ''
          }`}
        >
          <IconComponent className="w-5 h-5" />
        </div>
        <h3
          className={`font-semibold text-slate-900 ${
            !isInactive ? 'group-hover:text-rose-600' : 'text-slate-500'
          } transition-colors`}
        >
          {tool.name}
        </h3>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
          {tool.desc}
        </p>
      </div>
    </button>
  );
}