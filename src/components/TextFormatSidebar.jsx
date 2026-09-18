import React, { useState, useRef, useEffect } from 'react';
import {
  Bold, Italic, Underline, Strikethrough, Superscript, Subscript,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Trash2, Sparkles, Info, X as CloseIcon,
} from 'lucide-react';

const FONT_GROUPS = [
  { group: 'System', fonts: ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Calibri', 'Cambria'] },
  { group: 'Sans-Serif', fonts: ['Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Inter', 'Nunito', 'Raleway', 'Work Sans', 'Ubuntu', 'Rubik', 'Karla', 'Mulish', 'Manrope', 'DM Sans', 'Jost', 'Arimo'] },
  { group: 'Serif', fonts: ['Merriweather', 'Playfair Display', 'Lora', 'PT Serif', 'Crimson Text', 'Libre Baskerville', 'EB Garamond', 'Cormorant Garamond', 'Noto Serif', 'Bitter', 'Tinos', 'Gelasio'] },
  { group: 'Monospace', fonts: ['JetBrains Mono', 'Fira Code', 'Source Code Pro', 'IBM Plex Mono', 'Roboto Mono', 'Cousine'] },
  { group: 'Display', fonts: ['Oswald', 'Bebas Neue', 'Lobster', 'Pacifico', 'Dancing Script', 'Great Vibes', 'Caveat', 'Satisfy'] },
];

const GOOGLE_FONTS = new Set([
  ...FONT_GROUPS[1].fonts,
  ...FONT_GROUPS[2].fonts,
  ...FONT_GROUPS[3].fonts,
  ...FONT_GROUPS[4].fonts,
]);
const SYSTEM_FONTS = new Set(FONT_GROUPS[0].fonts);

const SWATCHES = [
  [0, 0, 0], [0.5, 0.5, 0.5], [0.85, 0.85, 0.85], [1, 1, 1],
  [0.86, 0.15, 0.15], [0.95, 0.55, 0.1], [0.95, 0.85, 0.15], [0.1, 0.5, 0.9],
];

function rgbToCss(rgb) {
  if (!rgb) return 'rgb(0,0,0)';
  return `rgb(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)})`;
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [r, g, b];
}

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</h4>
      {children}
    </div>
  );
}

function SpacingRow({ label, value, onChange, step = 1, min = -Infinity, max = Infinity }) {
  const clamp = (v) => Math.max(min, Math.min(max, v));
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-slate-600 font-medium whitespace-nowrap">{label}</span>
      <div className="flex items-center border border-slate-200 rounded-md overflow-hidden bg-white">
        <input type="number" value={value} step={step}
          onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
          className="w-14 px-1.5 py-1 text-[11px] font-medium text-center focus:outline-none" />
        <div className="flex flex-col border-l border-slate-200">
          <button type="button" onClick={() => onChange(clamp(value + step))}
            className="px-1 text-[7px] text-slate-400 hover:text-slate-700 hover:bg-slate-50 leading-none">▲</button>
          <button type="button" onClick={() => onChange(clamp(value - step))}
            className="px-1 text-[7px] text-slate-400 hover:text-slate-700 hover:bg-slate-50 leading-none border-t border-slate-200">▼</button>
        </div>
      </div>
    </div>
  );
}

export default function TextFormatSidebar({
  activeStyle, onChange, isActive, selectionLabel, onDelete,
  rangeInfo, onClearRangeOverride,
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const palRef = useRef(null);

  useEffect(() => {
    if (!paletteOpen) return;
    const onDoc = (e) => { if (palRef.current && !palRef.current.contains(e.target)) setPaletteOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [paletteOpen]);

  const disabled = !isActive;
  const effColor = activeStyle.color || [0, 0, 0];
  const patch = (p) => onChange({ ...activeStyle, ...p });
  const activeCls = (v) => v ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100';
  const disabledCls = disabled ? 'opacity-40 pointer-events-none select-none' : '';
  const detectedFont = activeStyle.detectedFontFamily || null;
  const isGoogleDetected = detectedFont && GOOGLE_FONTS.has(detectedFont);
  const isSystemDetected = detectedFont && SYSTEM_FONTS.has(detectedFont);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Format</h3>
        {selectionLabel ? (
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            Editing: <span className="font-semibold text-slate-700">{selectionLabel}</span>
          </p>
        ) : (
          <p className="text-[11px] text-slate-400 mt-1">Click any text to start formatting</p>
        )}

        {/* Range indicator */}
        {rangeInfo && (
          <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-emerald-700">
                Applying to selected ({rangeInfo.count} char{rangeInfo.count === 1 ? '' : 's'})
              </p>
              <p className="text-[10px] text-emerald-600 truncate font-mono">
                "{rangeInfo.text.length > 24 ? rangeInfo.text.slice(0, 24) + '…' : rangeInfo.text}"
              </p>
            </div>
            {onClearRangeOverride && (
              <button type="button" onClick={onClearRangeOverride}
                className="p-1 text-emerald-600 hover:bg-emerald-100 rounded shrink-0 cursor-pointer"
                title="Clear override on selection">
                <CloseIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className={`p-4 space-y-5 ${disabledCls}`}>
        <Section title="Font">
          <div className="flex items-center gap-2">
            <select value={activeStyle.fontFamily || ''}
              onChange={(e) => patch({ fontFamily: e.target.value || null })}
              className="flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">{detectedFont ? `Original (${detectedFont})` : 'Original'}</option>
              {FONT_GROUPS.map((grp) => (
                <optgroup key={grp.group} label={grp.group}>
                  {grp.fonts.map((f) => (
                    <option key={f} value={f} style={{ fontFamily: `"${f}", sans-serif` }}>{f}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <input type="number" min="4" max="300" value={activeStyle.fontSize ?? ''}
              onChange={(e) => patch({ fontSize: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="Size"
              className="w-14 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          {detectedFont && !activeStyle.fontFamily && (
            <div className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-tight">
              <Sparkles className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-slate-500">
                Detected: <strong className="font-semibold text-slate-700">{detectedFont}</strong>
                {isGoogleDetected && ' — new characters in same family'}
                {isSystemDetected && ' — perfectly preserved'}
                {!isGoogleDetected && !isSystemDetected && ' — new characters will use a close clone'}
              </p>
            </div>
          )}
        </Section>

        <Section title="Color">
          <div className="flex items-center gap-2 flex-wrap">
            {SWATCHES.map((c, i) => {
              const isActiveSwatch = c.every((v, k) => Math.abs(v - effColor[k]) < 0.02);
              return (
                <button key={i} type="button" onClick={() => patch({ color: c })}
                  className={`w-6 h-6 rounded-full border transition ${
                    isActiveSwatch ? 'ring-2 ring-blue-500 ring-offset-2 border-white' : 'border-slate-300 hover:scale-110'
                  }`}
                  style={{ background: rgbToCss(c) }} />
              );
            })}
            <div ref={palRef} className="relative">
              <button type="button" onClick={() => setPaletteOpen((v) => !v)}
                className="w-6 h-6 rounded-full border border-slate-300"
                style={{ background: 'conic-gradient(from 0deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)' }}
                title="Custom color" />
              {paletteOpen && (
                <div className="absolute top-full left-0 mt-2 p-2 bg-white border border-slate-200 rounded-xl shadow-2xl grid grid-cols-4 gap-1.5 z-50 w-max">
                  {[...Array(16)].map((_, i) => {
                    const hue = (i * 24) % 360;
                    const rgb = hslToRgb(hue / 360, 0.75, 0.5);
                    return (
                      <button key={i} type="button"
                        onClick={() => { patch({ color: rgb }); setPaletteOpen(false); }}
                        className="w-5 h-5 rounded-md border border-slate-200 hover:scale-110 whitespace-nowrap transition"
                        style={{ background: rgbToCss(rgb) }} />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section title="Alignment">
          <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-100 rounded-lg">
            {[
              { v: 'left', Icon: AlignLeft }, { v: 'center', Icon: AlignCenter },
              { v: 'right', Icon: AlignRight }, { v: 'justify', Icon: AlignJustify },
            ].map(({ v, Icon }) => (
              <button key={v} type="button" onClick={() => patch({ align: v })} title={v}
                className={`py-1.5 rounded-md flex items-center justify-center transition ${
                  (activeStyle.align || 'left') === v ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}>
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </Section>

        <Section title="Style">
          <div className="grid grid-cols-6 gap-1">
            <button type="button" onClick={() => patch({ bold: !activeStyle.bold })} title="Bold"
              className={`h-8 rounded-lg flex items-center justify-center transition ${activeCls(activeStyle.bold)}`}>
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => patch({ italic: !activeStyle.italic })} title="Italic"
              className={`h-8 rounded-lg flex items-center justify-center transition ${activeCls(activeStyle.italic)}`}>
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => patch({ underline: !activeStyle.underline })} title="Underline"
              className={`h-8 rounded-lg flex items-center justify-center transition ${activeCls(activeStyle.underline)}`}>
              <Underline className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => patch({ strike: !activeStyle.strike })} title="Strikethrough"
              className={`h-8 rounded-lg flex items-center justify-center transition ${activeCls(activeStyle.strike)}`}>
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => patch({ superscript: !activeStyle.superscript, subscript: false })} title="Superscript"
              className={`h-8 rounded-lg flex items-center justify-center transition ${activeCls(activeStyle.superscript)}`}>
              <Superscript className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => patch({ superscript: false, subscript: !activeStyle.subscript })} title="Subscript"
              className={`h-8 rounded-lg flex items-center justify-center transition ${activeCls(activeStyle.subscript)}`}>
              <Subscript className="w-3.5 h-3.5" />
            </button>
          </div>
        </Section>

        <Section title="Spacing">
          <div className="space-y-2">
            <SpacingRow label="Line Spacing" value={activeStyle.lineSpacing ?? 1.15}
              step={0.05} min={0.5} max={4}
              onChange={(v) => patch({ lineSpacing: v })} />
            <SpacingRow label="Character Spacing" value={activeStyle.charSpacing ?? 0}
              step={0.25} min={-2} max={10}
              onChange={(v) => patch({ charSpacing: v })} />
            <SpacingRow label="Horizontal Scale %" value={activeStyle.hScale ?? 100}
              step={5} min={50} max={200}
              onChange={(v) => patch({ hScale: v })} />
          </div>
        </Section>

        <Section title="Outline">
          <div className="flex items-center gap-2">
            <button type="button"
              onClick={() => {
                if (activeStyle.outlineColor) patch({ outlineColor: null, outlineWidth: 0 });
                else patch({ outlineColor: [0, 0, 0], outlineWidth: 1 });
              }}
              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition ${
                activeStyle.outlineColor ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-300'
              }`}
              style={{
                background: activeStyle.outlineColor
                  ? rgbToCss(activeStyle.outlineColor)
                  : 'conic-gradient(from 0deg, #ef4444, #f59e0b, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ef4444)',
              }} />
            <input type="number" min="0" max="20" step="0.5"
              value={activeStyle.outlineWidth ?? 0}
              onChange={(e) => patch({
                outlineWidth: Number(e.target.value) || 0,
                outlineColor: activeStyle.outlineColor || [0, 0, 0],
              })}
              className="w-14 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            <span className="text-[11px] text-slate-500">pt</span>
          </div>
        </Section>

        <Section title="Direction">
          <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100 rounded-lg">
            {[{ v: 'auto', label: 'Auto' }, { v: 'ltr', label: 'LTR' }, { v: 'rtl', label: 'RTL' }].map(({ v, label }) => (
              <button key={v} type="button" onClick={() => patch({ direction: v })}
                className={`py-1.5 rounded-md text-[11px] font-bold transition ${
                  (activeStyle.direction || 'auto') === v ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </Section>

        {isActive && onDelete && (
          <button type="button" onClick={onDelete}
            className="w-full py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Text</span>
          </button>
        )}
      </div>
    </div>
  );
}