import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowLeft, Loader2, ChevronUp, ChevronDown, ZoomIn, ZoomOut, Maximize,
  Type, AlertCircle, Info, Check, MousePointerClick, RotateCcw, Download,
  ArrowRight, FileImage, Edit3, GripVertical, Trash2, Plus, Square, Circle,
  Minus, ArrowUpRight, Triangle, Diamond,
  ChevronDown as ChevronDownIcon,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { editPdfText, checkPdfPassword } from '../utils/pdfWorker';
import TextFormatSidebar from './TextFormatSidebar';

// ---------------------------------------------------------------------------
// PDF.js worker
// ---------------------------------------------------------------------------
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------
const COLOR_PALETTE = [
  [0, 0, 0], [0.25, 0.25, 0.25], [0.5, 0.5, 0.5], [0.75, 0.75, 0.75],
  [1, 1, 1], [0.86, 0.15, 0.15], [0.95, 0.42, 0.1], [0.95, 0.75, 0.1],
  [0.1, 0.65, 0.3], [0.1, 0.5, 0.9], [0.5, 0.2, 0.8], [0.85, 0.2, 0.6],
  [0.1, 0.2, 0.5], [0.1, 0.5, 0.5], [0.5, 0.3, 0.2], [0.95, 0.95, 0.95],
];

// ---------------------------------------------------------------------------
// Font helpers
// ---------------------------------------------------------------------------
function parseFontFallback(rawName) {
  const name = (rawName || 'Helvetica').replace(/^[A-Z]{6}\+/, '');
  const isBold = /bold|black|heavy|semibold|demibold|extrabold/i.test(name);
  const isItalic = /italic|oblique/i.test(name);
  let family = 'Helvetica, Arial, sans-serif';
  let cssFallback = 'sans-serif';
  if (/times|serif|roman|georgia|garamond|book/i.test(name)) {
    family = '"Times New Roman", Times, "Liberation Serif", Georgia, serif';
    cssFallback = 'serif';
  } else if (/courier|mono|consol/i.test(name)) {
    family = '"Courier New", Courier, "Liberation Mono", monospace';
    cssFallback = 'monospace';
  } else if (/arial|helvetica|helv/i.test(name)) {
    family = 'Arial, Helvetica, "Liberation Sans", sans-serif';
  } else if (/calibri/i.test(name)) {
    family = 'Calibri, "Segoe UI", "Carlito", Arial, sans-serif';
  }
  return { family, isBold, isItalic, cssFallback };
}

function cssStackFromFamily(family) {
  const f = (family || '').toLowerCase();
  if (f.includes('times') || f.includes('georgia')) {
    return '"Times New Roman", Times, "Liberation Serif", Georgia, serif';
  }
  if (f.includes('courier')) {
    return '"Courier New", Courier, "Liberation Mono", monospace';
  }
  if (f.includes('helvetica') || f.includes('arial') || f.includes('calibri') || f.includes('verdana')) {
    return 'Arial, Helvetica, "Liberation Sans", sans-serif';
  }
  return 'Arial, Helvetica, sans-serif';
}

function getRealFontName(page, fontId) {
  try {
    if (!page?.commonObjs?.has?.(fontId)) return null;
    const rawName = page.commonObjs.get(fontId)?.name || '';
    return rawName.replace(/^[A-Z]{6}\+/, '') || null;
  } catch { return null; }
}

function rgbToCss(rgb) {
  return `rgb(${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)})`;
}

function formatFileSize(bytes) {
  if (!bytes) return '0 KB';
  const k = 1024;
  return bytes < k * k ? `${(bytes / k).toFixed(1)} KB` : `${(bytes / (k * k)).toFixed(2)} MB`;
}

// ---------------------------------------------------------------------------
// Coordinate transforms
// ---------------------------------------------------------------------------
function pdfXYToCanvas(pdfX, pdfYTopDown, transform, pageView) {
  const [a, b, c, d, e, f] = transform;
  const pdfYBottom = pageView[3] - pdfYTopDown;
  return [a * pdfX + c * pdfYBottom + e, b * pdfX + d * pdfYBottom + f];
}

function canvasXYToPdf(cx, cy, transform, pageView) {
  const [a, b, c, d, e, f] = transform;
  const det = a * d - b * c || 1;
  const pdfX = (d * (cx - e) - c * (cy - f)) / det;
  const pdfYBottom = (-b * (cx - e) + a * (cy - f)) / det;
  return [pdfX, pageView[3] - pdfYBottom];
}

// ---------------------------------------------------------------------------
// Baseline measurement
// ---------------------------------------------------------------------------
const _baselineCache = {};
function getBaselineFromTop(cssFont, fontPx, lineHeightPx) {
  const key = `${cssFont}|${fontPx.toFixed(2)}|${lineHeightPx.toFixed(2)}`;
  if (_baselineCache[key] !== undefined) return _baselineCache[key];
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${fontPx}px ${cssFont}`;
    const m = ctx.measureText('Hgjy|');
    const asc = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent ?? fontPx * 0.75;
    const desc = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent ?? fontPx * 0.25;
    return (_baselineCache[key] = (lineHeightPx - (asc + desc)) / 2 + asc);
  } catch {
    return (_baselineCache[key] = lineHeightPx / 2 + fontPx * 0.3);
  }
}

function sampleSpanColor(ctx, span) {
  const cx = span.canvasX + span.widthPx * 0.5;
  const cy = span.canvasYBaseline - span.fontPx * 0.35;
  const patch = 5;
  const px = Math.max(0, Math.min(ctx.canvas.width - patch, Math.round(cx - patch / 2)));
  const py = Math.max(0, Math.min(ctx.canvas.height - patch, Math.round(cy - patch / 2)));
  try {
    const data = ctx.getImageData(px, py, patch, patch).data;
    let best = [0, 0, 0], bestDist = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 40) continue;
      const dist = Math.abs(255 - data[i]) + Math.abs(255 - data[i + 1]) + Math.abs(255 - data[i + 2]);
      if (dist > bestDist) { bestDist = dist; best = [data[i], data[i + 1], data[i + 2]]; }
    }
    return [best[0] / 255, best[1] / 255, best[2] / 255];
  } catch { return [0, 0, 0]; }
}

// ---------------------------------------------------------------------------
// contentEditable text editor
// ---------------------------------------------------------------------------
function TextEditBox({ initialText, style, onInput, onCommit, onCancel, onMouseDownInternal }) {
  const ref = useRef(null);
  const committedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.textContent = initialText;
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch { /* ignore */ }
    el.focus();
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (committedRef.current) return;
      committedRef.current = true;
      onCommit(ref.current?.textContent ?? '');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (committedRef.current) return;
      committedRef.current = true;
      onCancel();
    }
  };

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onKeyDown={handleKeyDown}
      onMouseDown={onMouseDownInternal}
      onInput={(e) => onInput?.(e.currentTarget.textContent ?? '')}
      style={style}
    />
  );
}

// ---------------------------------------------------------------------------
// Quick actions toolbar (drag grip + delete for existing spans)
// ---------------------------------------------------------------------------
function QuickActionsToolbar({ onDelete, onMoveStart, position }) {
  return (
    <div
      data-in-edit-toolbar="1"
      className="fixed z-[9999] flex items-center gap-1 px-2 py-1.5 bg-slate-900/95 backdrop-blur-md text-white rounded-xl shadow-2xl border border-slate-700/60 select-none"
      style={{ left: position.x, top: position.y }}
    >
      <button type="button" title="Drag to move" onPointerDown={onMoveStart}
        className="p-1 rounded hover:bg-slate-700 cursor-grab active:cursor-grabbing text-slate-300">
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <div className="w-px h-4 bg-slate-700" />
      <button type="button" onClick={onDelete} title="Delete"
        className="w-7 h-7 rounded-md flex items-center justify-center text-red-300 hover:bg-red-600 hover:text-white transition">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shape renderer
// ---------------------------------------------------------------------------
function ShapeRenderer({ shapeType, strokeColor, strokeWidth, fillColor }) {
  const stroke = rgbToCss(strokeColor);
  const fill = fillColor ? rgbToCss(fillColor) : 'none';
  const common = {
    stroke, strokeWidth, fill,
    vectorEffect: 'non-scaling-stroke',
    strokeLinejoin: 'round', strokeLinecap: 'round',
  };
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"
      style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}>
      {shapeType === 'rect' && <rect x="1" y="1" width="98" height="98" {...common} />}
      {shapeType === 'ellipse' && <ellipse cx="50" cy="50" rx="49" ry="49" {...common} />}
      {shapeType === 'line' && <line x1="0" y1="100" x2="100" y2="0" {...common} />}
      {shapeType === 'arrow' && (
        <>
          <line x1="0" y1="100" x2="100" y2="0" {...common} />
          <polygon points="100,0 78,10 90,22" fill={stroke} stroke={stroke} vectorEffect="non-scaling-stroke" />
        </>
      )}
      {shapeType === 'triangle' && <polygon points="50,2 98,98 2,98" {...common} />}
      {shapeType === 'diamond' && <polygon points="50,2 98,50 50,98 2,50" {...common} />}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Shape toolbar (stroke color, width, fill)
// ---------------------------------------------------------------------------
function ShapeColorButton({ value, onChange, title, allowNone }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const isNone = allowNone && value === null;
  const current = value || [0, 0, 0];

  return (
    <div ref={ref} className="relative">
      <button type="button" title={title} onClick={() => setOpen((v) => !v)}
        className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-slate-700 transition">
        {isNone ? (
          <span className="w-4 h-4 rounded border border-slate-500 flex items-center justify-center text-[9px] text-slate-400">∅</span>
        ) : (
          <span className="w-4 h-4 rounded border border-slate-500 shadow-inner" style={{ background: rgbToCss(current) }} />
        )}
      </button>
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl grid grid-cols-4 gap-1.5 z-[10000]">
          {allowNone && (
            <button type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className={`w-5 h-5 rounded-md border text-[9px] text-slate-300 ${isNone ? 'border-blue-400 ring-2 ring-blue-500/50' : 'border-slate-600'}`}>∅</button>
          )}
          {COLOR_PALETTE.map((c, i) => {
            const active = !isNone && Math.abs(c[0] - current[0]) < 0.01 && Math.abs(c[1] - current[1]) < 0.01 && Math.abs(c[2] - current[2]) < 0.01;
            return (
              <button key={i} type="button"
                onClick={() => { onChange(c); setOpen(false); }}
                className={`w-5 h-5 rounded-md border transition hover:scale-110 ${active ? 'border-blue-400 ring-2 ring-blue-500/50' : 'border-slate-600'}`}
                style={{ background: rgbToCss(c) }} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ShapeToolbar({ addition, onChange, onDelete, onMoveStart, position }) {
  if (!addition) return null;
  return (
    <div
      data-in-edit-toolbar="1"
      className="fixed z-[9999] flex items-center gap-1 px-2 py-1.5 bg-slate-900/95 backdrop-blur-md text-white rounded-xl shadow-2xl border border-slate-700/60 select-none"
      style={{ left: position.x, top: position.y }}
    >
      <button type="button" title="Drag to move" onPointerDown={onMoveStart}
        className="p-1 rounded hover:bg-slate-700 cursor-grab active:cursor-grabbing text-slate-300">
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <div className="w-px h-4 bg-slate-700" />
      <ShapeColorButton
        value={addition.strokeColor || [0, 0, 0]}
        onChange={(c) => onChange({ strokeColor: c })}
        title="Stroke color"
      />
      <div className="flex items-center gap-1 ml-1">
        <span className="text-[10px] text-slate-400">W</span>
        <input type="range" min="1" max="20" value={addition.strokeWidth ?? 2}
          onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })}
          className="w-16 accent-blue-500" />
        <span className="text-[10px] text-slate-300 w-4 text-right">{addition.strokeWidth ?? 2}</span>
      </div>
      <div className="w-px h-4 bg-slate-700" />
      <ShapeColorButton
        value={addition.fillColor}
        onChange={(c) => onChange({ fillColor: c })}
        title="Fill color"
        allowNone
      />
      <div className="w-px h-4 bg-slate-700" />
      <button type="button" onClick={onDelete}
        className="w-7 h-7 rounded-md flex items-center justify-center text-red-300 hover:bg-red-600 hover:text-white transition">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tools bar (Add Text + Shapes dropdown)
// ---------------------------------------------------------------------------
function ToolsBar({ toolMode, setToolMode }) {
  const [shapesOpen, setShapesOpen] = useState(false);
  const shapesWrapRef = useRef(null);

  useEffect(() => {
    if (!shapesOpen) return;
    const onDoc = (e) => {
      if (shapesWrapRef.current && !shapesWrapRef.current.contains(e.target)) setShapesOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [shapesOpen]);

  const shapes = [
    { id: 'rect',     label: 'Rectangle', short: 'Rect',     icon: Square },
    { id: 'ellipse',  label: 'Ellipse',   short: 'Ellipse',  icon: Circle },
    { id: 'line',     label: 'Line',      short: 'Line',     icon: Minus },
    { id: 'arrow',    label: 'Arrow',     short: 'Arrow',    icon: ArrowUpRight },
    { id: 'triangle', label: 'Triangle',  short: 'Triangle', icon: Triangle },
    { id: 'diamond',  label: 'Diamond',   short: 'Diamond',  icon: Diamond },
  ];
  const shapesActive = shapes.some((s) => s.id === toolMode);

  return (
    <div data-in-edit-toolbar="1"
      className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-white border border-slate-200 rounded-2xl shadow-lg px-2 py-1.5">
      <button
        type="button"
        onClick={() => { setToolMode(toolMode === 'text' ? null : 'text'); setShapesOpen(false); }}
        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
          toolMode === 'text' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add Text</span>
      </button>

      <div className="w-px h-5 bg-slate-200" />

      <div ref={shapesWrapRef} className="relative">
        <button
          type="button"
          onClick={() => setShapesOpen((v) => !v)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
            shapesActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Square className="w-3.5 h-3.5" />
          <span>Shapes</span>
          <ChevronDownIcon className={`w-3 h-3 transition-transform ${shapesOpen ? 'rotate-180' : ''}`} />
        </button>

        {shapesOpen && (
          <div data-in-edit-toolbar="1"
            className="absolute top-full right-0 mt-2 p-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[60] w-max">
            <div className="grid grid-cols-3 gap-1">
              {shapes.map((s) => {
                const Icon = s.icon;
                const isActive = toolMode === s.id;
                return (
                  <button key={s.id} type="button"
                    onClick={() => { setToolMode(toolMode === s.id ? null : s.id); setShapesOpen(false); }}
                    title={s.label}
                    className={`flex flex-col items-center justify-center gap-1 px-2.5 py-2 rounded-xl text-[10px] font-semibold whitespace-nowrap transition cursor-pointer min-w-[68px] ${
                      isActive ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}>
                    <Icon className="w-4 h-4" />
                    <span>{s.short}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {toolMode && (
        <>
          <div className="w-px h-5 bg-slate-200" />
          <span className="text-[10px] text-slate-500 font-medium pr-1">
            {toolMode === 'text' ? 'Click to place text' : 'Click & drag to draw'}
          </span>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------
function getEffectiveStyle(span, style) {
  const family = style?.fontFamily || span.fontFamily;
  const originalSize = style?.fontSize ?? span.pdfFontSize;
  let size = originalSize;

  const bold = style?.bold != null ? style.bold : span.isBold;
  const italic = style?.italic != null ? style.italic : span.isItalic;

  const sup = Boolean(style?.superscript);
  const sub = !sup && Boolean(style?.subscript);
  if (sup || sub) size = originalSize * 0.65;
  const baselineShiftPt = sup ? originalSize * 0.35 : sub ? -originalSize * 0.15 : 0;

  return {
    family, size, bold, italic,
    underline: Boolean(style?.underline),
    strike: Boolean(style?.strike),
    superscript: sup, subscript: sub,
    baselineShiftPt,
    color: style?.color || span.color,
    align: style?.align || 'left',
    lineSpacing: style?.lineSpacing ?? null,
    charSpacing: style?.charSpacing ?? null,
    hScale: style?.hScale ?? null,
    outlineColor: style?.outlineColor || null,
    outlineWidth: style?.outlineWidth ?? 0,
    direction: style?.direction || 'auto',
    offsetX: style?.offsetX || 0,
    offsetY: style?.offsetY || 0,
  };
}

function cssStackFor(span, style) {
  if (style?.fontFamily) return cssStackFromFamily(style.fontFamily);
  return span.cssFont;
}

// Uses span.fontRaw (real PDF font name), NEVER the CSS stack.
// The CSS stack contains 'sans-serif', which incorrectly matched 'serif'.
function composeBackendFontName(span, style) {
  const bold = style?.bold != null ? style.bold : span.isBold;
  const italic = style?.italic != null ? style.italic : span.isItalic;

  let baseFamily;
  if (style?.fontFamily) {
    baseFamily = style.fontFamily;
  } else {
    const f = (span.fontRaw || '').toLowerCase();
    if (f.includes('times') || f.includes('georgia') || f.includes('garamond') ||
        f.includes('cambria') || f.includes('minion')) {
      baseFamily = 'Times';
    } else if (f.includes('courier') || f.includes('mono') || f.includes('consol')) {
      baseFamily = 'Courier';
    } else {
      baseFamily = 'Helvetica';
    }
  }

  let name = baseFamily;
  if (bold && italic) name += '-BoldItalic';
  else if (bold) name += '-Bold';
  else if (italic) name += '-Italic';
  return name;
}

function colorsEqual(a, b) {
  if (!a || !b) return false;
  return (
    Math.abs(a[0] - b[0]) < 0.02 &&
    Math.abs(a[1] - b[1]) < 0.02 &&
    Math.abs(a[2] - b[2]) < 0.02
  );
}

function buildEdit(span, draftText, activeStyle) {
  const eff = getEffectiveStyle(span, activeStyle);
  const originalBbox = [
    span.pdfX,
    span.pdfYBaselineTopDown - span.pdfFontSize * 0.9,
    span.pdfX + Math.max(span.pdfWidth, span.pdfFontSize * 0.5),
    span.pdfYBaselineTopDown + span.pdfFontSize * 0.15,
  ];

  const familyExplicit =
    activeStyle.fontFamily != null && activeStyle.fontFamily !== '';
  const fontChanged = familyExplicit;
  const sizeChanged =
    activeStyle.fontSize != null &&
    Math.abs(activeStyle.fontSize - span.pdfFontSize) > 0.5;
  const boldChanged =
    activeStyle.bold != null && activeStyle.bold !== span.isBold;
  const italicChanged =
    activeStyle.italic != null && activeStyle.italic !== span.isItalic;
  const colorChanged =
    activeStyle.color != null && !colorsEqual(activeStyle.color, span.color);
  const textChanged = draftText !== span.text;

  const nothingChanged =
    !textChanged && !fontChanged && !sizeChanged &&
    !boldChanged && !italicChanged && !colorChanged &&
    !activeStyle.underline && !activeStyle.strike &&
    !activeStyle.superscript && !activeStyle.subscript &&
    (activeStyle.align || 'left') === 'left' &&
    activeStyle.lineSpacing == null && activeStyle.charSpacing == null &&
    activeStyle.hScale == null && !activeStyle.outlineColor &&
    (!activeStyle.outlineWidth || activeStyle.outlineWidth === 0) &&
    eff.offsetX === 0 && eff.offsetY === 0;

  if (nothingChanged) return null;

  return {
    page: span.page,
    bbox: originalBbox,
    offsetX: eff.offsetX,
    offsetY: eff.offsetY,
    originalText: span.text,
    newText: String(draftText),
    fontName: composeBackendFontName(span, activeStyle),
    originalFontName: span.fontRaw,
    // Preserve original PDF font ONLY if the user hasn't touched
    // any font-affecting property.
    preserveOriginalFont:
      !familyExplicit && !boldChanged && !italicChanged,
    familyExplicit,
    bold: boldChanged ? activeStyle.bold : span.isBold,
    italic: italicChanged ? activeStyle.italic : span.isItalic,
    fontSize: activeStyle.fontSize ?? span.pdfFontSize,
    color: activeStyle.color ?? span.color,
    align: activeStyle.align || 'left',
    underline: Boolean(activeStyle.underline),
    strike: Boolean(activeStyle.strike),
    superscript: Boolean(activeStyle.superscript),
    subscript: Boolean(activeStyle.subscript),
    charSpacing: activeStyle.charSpacing ?? 0,
    lineSpacing: activeStyle.lineSpacing ?? 1.15,
    hScale: activeStyle.hScale ?? 100,
    outlineColor: activeStyle.outlineColor || null,
    outlineWidth: activeStyle.outlineWidth ?? 0,
    direction: activeStyle.direction || 'auto',
    // Persisted overrides for re-editing
    overrideFontFamily: activeStyle.fontFamily,
    overrideFontSize: activeStyle.fontSize,
    overrideBold: activeStyle.bold,
    overrideItalic: activeStyle.italic,
    overrideUnderline: activeStyle.underline,
    overrideStrike: activeStyle.strike,
    overrideSuperscript: activeStyle.superscript,
    overrideSubscript: activeStyle.subscript,
    overrideColor: activeStyle.color,
    overrideAlign: activeStyle.align,
    overrideLineSpacing: activeStyle.lineSpacing,
    overrideCharSpacing: activeStyle.charSpacing,
    overrideHScale: activeStyle.hScale,
    overrideOutlineColor: activeStyle.outlineColor,
    overrideOutlineWidth: activeStyle.outlineWidth,
    overrideDirection: activeStyle.direction,
  };
}

function emptyActiveStyle() {
  return {
    fontFamily: null, fontSize: null, bold: null, italic: null,
    underline: false, strike: false, superscript: false, subscript: false,
    color: null, align: 'left', lineSpacing: null, charSpacing: null, hScale: null,
    outlineColor: null, outlineWidth: 0, direction: 'auto',
    offsetX: 0, offsetY: 0,
  };
}

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================
export default function EditPdfStudio({ tool, file, onBack }) {
  const pdfDocRef = useRef(null);
  const viewerOuterRef = useRef(null);
  const pageContainerRef = useRef(null);
  const moveDragRef = useRef({ active: false, startX: 0, startY: 0, initX: 0, initY: 0 });
  const additionDragRef = useRef({ active: false });
  const drawingRectRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(0.5);
  const [userZoomed, setUserZoomed] = useState(false);
  const [naturalPageSize, setNaturalPageSize] = useState({ width: 0, height: 0 });

  const [pageDataUrl, setPageDataUrl] = useState('');
  const [pageDims, setPageDims] = useState({ width: 595, height: 842 });
  const [viewportTransform, setViewportTransform] = useState([1, 0, 0, -1, 0, 0]);
  const [pageView, setPageView] = useState([0, 0, 595, 842]);

  const [spans, setSpans] = useState([]);
  const [edits, setEdits] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [draftText, setDraftText] = useState('');
  const [activeStyle, setActiveStyle] = useState(emptyActiveStyle());

  const [additions, setAdditions] = useState([]);
  const [selectedAdditionId, setSelectedAdditionId] = useState(null);
  const [toolMode, setToolMode] = useState(null);
  const [drawingRect, setDrawingRect] = useState(null);
  const [editingAdditionId, setEditingAdditionId] = useState(null);
  const [additionDraftText, setAdditionDraftText] = useState('');

  const [toolbarPos, setToolbarPos] = useState({ x: -9999, y: -9999 });
  const [isMoving, setIsMoving] = useState(false);

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [viewerSize, setViewerSize] = useState({ w: 0, h: 0 });

  const stateRef = useRef({});
  stateRef.current = {
    selectedId, spans, edits, draftText, activeStyle,
    additions, selectedAdditionId, editingAdditionId, additionDraftText,
  };

  // Reset per file
  useEffect(() => {
    setUserZoomed(false);
    setZoom(0.5);
    setNaturalPageSize({ width: 0, height: 0 });
    setEdits({});
    setAdditions([]);
    setSelectedId(null);
    setSelectedAdditionId(null);
    setEditingAdditionId(null);
    setToolMode(null);
    setDrawingRect(null);
    drawingRectRef.current = null;
    setActiveStyle(emptyActiveStyle());
  }, [file]);

  // Escape key
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (toolMode) { setToolMode(null); setDrawingRect(null); drawingRectRef.current = null; return; }
      if (editingAdditionId) { setEditingAdditionId(null); return; }
      if (selectedAdditionId) { setSelectedAdditionId(null); return; }
      if (selectedId) { cancelEdit(); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolMode, editingAdditionId, selectedAdditionId, selectedId]);

  // Viewer size
  useEffect(() => {
    const el = viewerOuterRef.current;
    if (!el) return;
    const update = () => setViewerSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    let ro;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(update); ro.observe(el); }
    window.addEventListener('resize', update);
    return () => { if (ro) ro.disconnect(); window.removeEventListener('resize', update); };
  }, [loading, loadFailed, result]);

  // Auto-fit
  useEffect(() => {
    if (userZoomed || result) return;
    if (!naturalPageSize.width || !naturalPageSize.height) return;
    if (!viewerSize.w || !viewerSize.h) return;
    const availW = viewerSize.w - 40;
    const availH = viewerSize.h - 90;
    if (availW <= 0 || availH <= 0) return;
    const fitZoom = Math.min(availW / naturalPageSize.width, availH / naturalPageSize.height);
    const clamped = Math.max(0.2, Math.min(3.0, fitZoom));
    if (Math.abs(clamped - zoom) > 0.01) setZoom(clamped);
  }, [naturalPageSize, viewerSize, userZoomed, zoom, result]);

  // Load PDF
  useEffect(() => {
    let cancelled = false;
    pdfDocRef.current = null;
    setLoading(true);
    setLoadFailed(false);
    setErrorMsg('');
    (async () => {
      try {
        if (!file) { setLoading(false); setLoadFailed(true); return; }
        const isLocked = await checkPdfPassword(file);
        if (isLocked) {
          if (!cancelled) {
            setErrorMsg(`"${file.name}" is password-protected. Please unlock it first.`);
            setLoadFailed(true);
            setLoading(false);
          }
          return;
        }
        const buf = await file.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: buf }).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);
        setCurrentPage(1);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('PDF load error:', err);
          setErrorMsg('Failed to load PDF document.');
          setLoadFailed(true);
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [file]);

  // Render page + extract spans
  useEffect(() => {
    if (loading || !pdfDocRef.current || loadFailed || result) return;
    let cancelled = false;
    (async () => {
      setRendering(true);
      setErrorMsg('');
      setSpans([]);
      setSelectedId(null);
      try {
        const page = await pdfDocRef.current.getPage(currentPage);
        const unscaledVp = page.getViewport({ scale: 1 });
        setNaturalPageSize({ width: unscaledVp.width, height: unscaledVp.height });

        const vp = page.getViewport({ scale: zoom });
        setViewportTransform(vp.transform);
        setPageView(page.view);

        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(vp.width);
        canvas.height = Math.ceil(vp.height);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        if (cancelled) return;

        setPageDataUrl(canvas.toDataURL('image/jpeg', 0.92));
        setPageDims({ width: vp.width, height: vp.height });

        const tc = await page.getTextContent();
        const styles = tc.styles || {};
        const items = tc.items || [];

        const loadedFontNames = new Set();
        for (const item of items) if (item.fontName) loadedFontNames.add(item.fontName);
        for (const fontName of loadedFontNames) {
          try {
            let found = false;
            for (const f of document.fonts) if (f.family === fontName) { found = true; break; }
            if (!found && page.commonObjs?.has?.(fontName)) {
              const fd = page.commonObjs.get(fontName)?.data;
              if (fd) { const face = new FontFace(fontName, fd); await face.load(); document.fonts.add(face); }
            }
          } catch { /* ignore */ }
        }
        try { await document.fonts.ready; } catch { /* ignore */ }

        const [va, vb, vc, vd, ve, vf] = vp.transform;
        const [, , , viewY1] = page.view;
        const extracted = [];
        let idx = 0;
        for (const item of items) {
          if (!item.str || !item.str.trim()) continue;
          const tx = item.transform;
          const fontSize = Math.hypot(tx[2], tx[3]) || item.height || 12;
          const pdfX = tx[4];
          const pdfYBaseline = tx[5];
          const canvasX = va * pdfX + vc * pdfYBaseline + ve;
          const canvasYBaseline = vb * pdfX + vd * pdfYBaseline + vf;
          const canvasScale = Math.hypot(va, vc) || zoom;
          const fontPx = fontSize * canvasScale;
          const widthPx = (item.width || 0) * canvasScale;
          const styleInfo = styles[item.fontName] || {};
          const realFontName = getRealFontName(page, item.fontName);
          const rawFont = realFontName || styleInfo.fontFamily || item.fontName || 'Helvetica';
          const fallback = parseFontFallback(rawFont);
          const cssFontStack = `"${item.fontName}", ${fallback.family}, ${fallback.cssFallback}`;
          const yBaselineTopDownPdf = viewY1 - pdfYBaseline;
          const span = {
            id: `s-${currentPage}-${idx++}`, page: currentPage, text: item.str,
            canvasX, canvasYBaseline, fontPx, widthPx,
            pdfX, pdfYBaselineTopDown: yBaselineTopDownPdf, pdfFontSize: fontSize,
            pdfWidth: item.width || 0,
            fontRaw: rawFont, fontName: item.fontName,
            fontFamily: fallback.family, isBold: fallback.isBold, isItalic: fallback.isItalic,
            cssFont: cssFontStack, color: [0, 0, 0],
          };
          span.color = sampleSpanColor(ctx, span);
          extracted.push(span);
        }
        if (cancelled) return;
        setSpans(extracted);
      } catch (err) {
        if (!cancelled) {
          console.error('Render error:', err);
          setErrorMsg('Failed to render page. The file may be corrupted.');
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loading, loadFailed, currentPage, zoom, result]);

  // Toolbar position
  useEffect(() => {
    if (!selectedId) { setToolbarPos({ x: -9999, y: -9999 }); return; }
    const span = spans.find((s) => s.id === selectedId);
    if (!span || !pageContainerRef.current) return;
    const update = () => {
      const el = pageContainerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const eff = getEffectiveStyle(span, activeStyle);
      const spanPx = eff.size * zoom;
      const sx = rect.left + (span.canvasX + eff.offsetX * zoom);
      const sy = rect.top + (span.canvasYBaseline + eff.offsetY * zoom) - spanPx;
      const tbW = 120, tbH = 40;
      let left = Math.max(8, Math.min(window.innerWidth - tbW - 8, sx - 12));
      let top = sy - tbH - 10;
      if (top < 8) top = rect.top + (span.canvasYBaseline + eff.offsetY * zoom) + spanPx + 8;
      if (top + tbH > window.innerHeight - 8) top = window.innerHeight - tbH - 8;
      setToolbarPos({ x: left, y: top });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [selectedId, spans, activeStyle, zoom]);

  // Addition toolbar position
  const [additionToolbarPos, setAdditionToolbarPos] = useState({ x: -9999, y: -9999 });
  useEffect(() => {
    if (!selectedAdditionId) { setAdditionToolbarPos({ x: -9999, y: -9999 }); return; }
    const add = additions.find((a) => a.id === selectedAdditionId);
    if (!add || !pageContainerRef.current) return;
    if (add.type === 'text') { setAdditionToolbarPos({ x: -9999, y: -9999 }); return; }
    const update = () => {
      const el = pageContainerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const [cx0, cy0] = pdfXYToCanvas(add.bbox.x0, add.bbox.y0, viewportTransform, pageView);
      const [cx1, cy1] = pdfXYToCanvas(add.bbox.x1, add.bbox.y1, viewportTransform, pageView);
      const leftPx = rect.left + Math.min(cx0, cx1);
      const topPx = rect.top + Math.min(cy0, cy1);
      const tbW = 400, tbH = 40;
      let left = Math.max(8, Math.min(window.innerWidth - tbW - 8, leftPx - 12));
      let top = topPx - tbH - 10;
      if (top < 8) top = rect.top + Math.max(cy0, cy1) + 8;
      if (top + tbH > window.innerHeight - 8) top = window.innerHeight - tbH - 8;
      setAdditionToolbarPos({ x: left, y: top });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [selectedAdditionId, additions, viewportTransform, pageView]);

  // Begin editing an existing span
  const beginEdit = (span) => {
    if (selectedId && selectedId !== span.id) commitEdit();
    setSelectedAdditionId(null);
    setEditingAdditionId(null);
    setSelectedId(span.id);
    const existing = edits[span.id];
    if (existing) {
      setDraftText(existing.newText);
      setActiveStyle({
        fontFamily: existing.overrideFontFamily ?? null,
        fontSize: existing.overrideFontSize ?? null,
        bold: existing.overrideBold ?? null,
        italic: existing.overrideItalic ?? null,
        underline: existing.overrideUnderline ?? false,
        strike: existing.overrideStrike ?? false,
        superscript: existing.overrideSuperscript ?? false,
        subscript: existing.overrideSubscript ?? false,
        color: existing.overrideColor ?? null,
        align: existing.overrideAlign || 'left',
        lineSpacing: existing.overrideLineSpacing ?? null,
        charSpacing: existing.overrideCharSpacing ?? null,
        hScale: existing.overrideHScale ?? null,
        outlineColor: existing.overrideOutlineColor ?? null,
        outlineWidth: existing.overrideOutlineWidth ?? 0,
        direction: existing.overrideDirection || 'auto',
        offsetX: existing.offsetX ?? 0,
        offsetY: existing.offsetY ?? 0,
      });
    } else {
      setDraftText(span.text);
      setActiveStyle({
        fontFamily: null,
        fontSize: span.pdfFontSize,
        bold: span.isBold,
        italic: span.isItalic,
        underline: false,
        strike: false,
        superscript: false,
        subscript: false,
        color: span.color,
        align: 'left',
        lineSpacing: null,
        charSpacing: null,
        hScale: null,
        outlineColor: null,
        outlineWidth: 0,
        direction: 'auto',
        offsetX: 0,
        offsetY: 0,
      });
    }
  };

  // Begin editing a text addition
  const beginEditAddition = (add) => {
    setSelectedId(null);
    setSelectedAdditionId(add.id);
    setActiveStyle({
      fontFamily: add.fontName || null,
      fontSize: add.fontSize ?? null,
      bold: add.bold ?? null,
      italic: add.italic ?? null,
      underline: add.underline ?? false,
      strike: add.strike ?? false,
      superscript: add.superscript ?? false,
      subscript: add.subscript ?? false,
      color: add.color ?? null,
      align: add.align || 'left',
      lineSpacing: add.lineSpacing ?? null,
      charSpacing: add.charSpacing ?? null,
      hScale: add.hScale ?? null,
      outlineColor: add.outlineColor ?? null,
      outlineWidth: add.outlineWidth ?? 0,
      direction: add.direction || 'auto',
      offsetX: 0, offsetY: 0,
    });
  };

  const commitEdit = () => {
    const s = stateRef.current;
    if (!s.selectedId) return;
    const span = s.spans.find((x) => x.id === s.selectedId);
    if (!span) { setSelectedId(null); return; }
    const editObj = buildEdit(span, s.draftText, s.activeStyle);
    if (!editObj) {
      if (s.edits[span.id]) {
        setEdits((prev) => { const n = { ...prev }; delete n[span.id]; return n; });
      }
      setSelectedId(null);
      return;
    }
    setEdits((prev) => ({ ...prev, [span.id]: editObj }));
    setSelectedId(null);
  };

  const cancelEdit = () => {
    setSelectedId(null);
    setActiveStyle(emptyActiveStyle());
  };

  const handleDeleteText = () => {
    const s = stateRef.current;
    if (!s.selectedId) return;
    const span = s.spans.find((x) => x.id === s.selectedId);
    if (!span) return;
    const eff = getEffectiveStyle(span, s.activeStyle);
    const originalBbox = [
      span.pdfX,
      span.pdfYBaselineTopDown - span.pdfFontSize * 0.9,
      span.pdfX + Math.max(span.pdfWidth, span.pdfFontSize * 0.5),
      span.pdfYBaselineTopDown + span.pdfFontSize * 0.15,
    ];
    setEdits((prev) => ({
      ...prev,
      [span.id]: {
        page: span.page, bbox: originalBbox,
        offsetX: eff.offsetX, offsetY: eff.offsetY,
        originalText: span.text, newText: '',
        fontName: span.fontRaw, fontSize: span.pdfFontSize, color: span.color,
        align: 'left', underline: false, strike: false,
        superscript: false, subscript: false,
        charSpacing: 0, lineSpacing: 1.15, hScale: 100,
        outlineColor: null, outlineWidth: 0, direction: 'auto',
        originalFontName: span.fontRaw,
        preserveOriginalFont: false,
        familyExplicit: false,
        overrideFontFamily: null, overrideFontSize: null,
        overrideBold: null, overrideItalic: null,
        overrideUnderline: false, overrideStrike: false,
        overrideSuperscript: false, overrideSubscript: false,
        overrideColor: null, overrideAlign: 'left',
        overrideLineSpacing: null, overrideCharSpacing: null, overrideHScale: null,
        overrideOutlineColor: null, overrideOutlineWidth: 0, overrideDirection: 'auto',
      },
    }));
    setSelectedId(null);
  };

  // Route sidebar changes → span edit OR text addition
  const handleStyleChange = (newStyle) => {
    setActiveStyle(newStyle);
    const s = stateRef.current;

    if (s.selectedAdditionId) {
      const add = s.additions.find((a) => a.id === s.selectedAdditionId);
      if (add && add.type === 'text') {
        updateAddition(add.id, {
          fontName: newStyle.fontFamily || add.fontName,
          fontSize: newStyle.fontSize ?? add.fontSize,
          bold: newStyle.bold ?? add.bold,
          italic: newStyle.italic ?? add.italic,
          underline: newStyle.underline,
          strike: newStyle.strike,
          superscript: newStyle.superscript,
          subscript: newStyle.subscript,
          color: newStyle.color || add.color,
          align: newStyle.align || 'left',
          lineSpacing: newStyle.lineSpacing,
          charSpacing: newStyle.charSpacing,
          hScale: newStyle.hScale,
          outlineColor: newStyle.outlineColor,
          outlineWidth: newStyle.outlineWidth,
          direction: newStyle.direction || 'auto',
        });
      }
      return;
    }

    if (s.selectedId) {
      const span = s.spans.find((x) => x.id === s.selectedId);
      if (!span) return;
      const editObj = buildEdit(span, s.draftText, newStyle);
      setEdits((prev) => {
        if (!editObj) {
          if (!prev[span.id]) return prev;
          const next = { ...prev };
          delete next[span.id];
          return next;
        }
        return { ...prev, [span.id]: editObj };
      });
    }
  };

  const handleDeleteSelected = () => {
    if (selectedId) handleDeleteText();
    else if (selectedAdditionId) deleteAddition(selectedAdditionId);
  };

  // Create text addition
  const createTextAddition = (canvasX, canvasY) => {
    const [pdfX, pdfYTop] = canvasXYToPdf(canvasX, canvasY, viewportTransform, pageView);
    const id = `add-text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const defaultSize = 14;
    const newAdd = {
      id, page: currentPage, type: 'text',
      bbox: { x0: pdfX, y0: pdfYTop - defaultSize * 0.9, x1: pdfX + 120, y1: pdfYTop },
      text: '',
      fontName: 'Helvetica', fontSize: defaultSize,
      bold: false, italic: false, underline: false,
      strike: false, superscript: false, subscript: false,
      color: [0, 0, 0], align: 'left',
      charSpacing: 0, lineSpacing: 1.15, hScale: 100,
      outlineColor: null, outlineWidth: 0, direction: 'auto',
    };
    setAdditions((prev) => [...prev, newAdd]);
    setSelectedAdditionId(id);
    setEditingAdditionId(id);
    setAdditionDraftText('');
    setToolMode(null);
    setActiveStyle({
      fontFamily: 'Helvetica', fontSize: defaultSize,
      bold: false, italic: false, underline: false,
      strike: false, superscript: false, subscript: false,
      color: [0, 0, 0], align: 'left',
      charSpacing: 0, lineSpacing: 1.15, hScale: 100,
      outlineColor: null, outlineWidth: 0, direction: 'auto',
      offsetX: 0, offsetY: 0,
    });
  };

  const createShapeAddition = (x0, y0, x1, y1, shapeType) => {
    const [pdfX0, pdfY0] = canvasXYToPdf(x0, y0, viewportTransform, pageView);
    const [pdfX1, pdfY1] = canvasXYToPdf(x1, y1, viewportTransform, pageView);
    const id = `add-shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newAdd = {
      id, page: currentPage, type: 'shape', shapeType,
      bbox: {
        x0: Math.min(pdfX0, pdfX1), y0: Math.min(pdfY0, pdfY1),
        x1: Math.max(pdfX0, pdfX1), y1: Math.max(pdfY0, pdfY1),
      },
      strokeColor: [0, 0, 0], strokeWidth: 2, fillColor: null,
    };
    setAdditions((prev) => [...prev, newAdd]);
    setSelectedAdditionId(id);
    setToolMode(null);
    setActiveStyle(emptyActiveStyle());
  };

  // Page mousedown (drawing)
  const handlePageMouseDown = (e) => {
    if (!toolMode || !pageContainerRef.current) return;
    if (e.target.closest('[data-in-edit-toolbar]')) return;
    if (e.target.closest('[data-in-edit-box]')) return;
    if (e.target.closest('[data-addition-node]')) return;

    const rect = pageContainerRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    if (toolMode === 'text') { createTextAddition(cx, cy); return; }

    const capturedToolMode = toolMode;
    const startState = { startX: cx, startY: cy, currentX: cx, currentY: cy };
    drawingRectRef.current = startState;
    setDrawingRect(startState);

    const onMove = (me) => {
      if (!drawingRectRef.current) return;
      const r = pageContainerRef.current?.getBoundingClientRect();
      if (!r) return;
      const mx = me.clientX - r.left;
      const my = me.clientY - r.top;
      const next = { ...drawingRectRef.current, currentX: mx, currentY: my };
      drawingRectRef.current = next;
      setDrawingRect(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const finalRect = drawingRectRef.current;
      drawingRectRef.current = null;
      setDrawingRect(null);
      if (!finalRect) return;
      const x0 = Math.min(finalRect.startX, finalRect.currentX);
      const y0 = Math.min(finalRect.startY, finalRect.currentY);
      const x1 = Math.max(finalRect.startX, finalRect.currentX);
      const y1 = Math.max(finalRect.startY, finalRect.currentY);
      if (Math.abs(x1 - x0) > 4 && Math.abs(y1 - y0) > 4) {
        createShapeAddition(x0, y0, x1, y1, capturedToolMode);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const updateAddition = (id, patch) => {
    setAdditions((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const deleteAddition = (id) => {
    setAdditions((prev) => prev.filter((a) => a.id !== id));
    if (selectedAdditionId === id) setSelectedAdditionId(null);
    if (editingAdditionId === id) setEditingAdditionId(null);
  };

  const handleAdditionDragStart = (e, additionId, mode, handle = null) => {
    e.preventDefault();
    e.stopPropagation();
    const add = additions.find((a) => a.id === additionId);
    if (!add) return;

    additionDragRef.current = {
      active: true, additionId, mode, handle,
      startX: e.clientX, startY: e.clientY,
      initialBox: { ...add.bbox },
    };

    const onMove = (me) => {
      const ref = additionDragRef.current;
      if (!ref.active) return;
      const dxPx = me.clientX - ref.startX;
      const dyPx = me.clientY - ref.startY;
      const dxPdf = dxPx / zoom;
      const dyPdf = dyPx / zoom;
      const b = { ...ref.initialBox };

      if (mode === 'move') {
        b.x0 = ref.initialBox.x0 + dxPdf;
        b.y0 = ref.initialBox.y0 + dyPdf;
        b.x1 = ref.initialBox.x1 + dxPdf;
        b.y1 = ref.initialBox.y1 + dyPdf;
      } else if (mode === 'resize') {
        if (handle.includes('w')) b.x0 = ref.initialBox.x0 + dxPdf;
        if (handle.includes('e')) b.x1 = ref.initialBox.x1 + dxPdf;
        if (handle.includes('n')) b.y0 = ref.initialBox.y0 + dyPdf;
        if (handle.includes('s')) b.y1 = ref.initialBox.y1 + dyPdf;
        if (b.x0 > b.x1) [b.x0, b.x1] = [b.x1, b.x0];
        if (b.y0 > b.y1) [b.y0, b.y1] = [b.y1, b.y0];
      }
      updateAddition(ref.additionId, { bbox: b });
    };
    const onUp = () => {
      additionDragRef.current.active = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Outside-click commit
  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (stateRef.current.selectedId) {
        if (!e.target.closest('[data-in-edit-toolbar]') && !e.target.closest('[data-in-edit-box]') && !e.target.closest('[data-format-sidebar]')) {
          commitEdit();
        }
      }
      if (stateRef.current.editingAdditionId) {
        if (!e.target.closest('[data-in-edit-toolbar]') && !e.target.closest('[data-addition-node]') && !e.target.closest('[data-format-sidebar]')) {
          const addId = stateRef.current.editingAdditionId;
          const draft = stateRef.current.additionDraftText ?? '';
          setAdditions((prev) => prev.map((a) => (a.id === addId ? { ...a, text: draft } : a)));
          setEditingAdditionId(null);
        }
      }
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    return () => document.removeEventListener('mousedown', onDocMouseDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move grip for existing span
  const handleMoveStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    moveDragRef.current = {
      active: true, startX: e.clientX, startY: e.clientY,
      initX: activeStyle.offsetX || 0, initY: activeStyle.offsetY || 0,
    };
    setIsMoving(true);
    const onMove = (me) => {
      if (!moveDragRef.current.active) return;
      const dx = me.clientX - moveDragRef.current.startX;
      const dy = me.clientY - moveDragRef.current.startY;
      setActiveStyle((prev) => ({
        ...prev,
        offsetX: moveDragRef.current.initX + dx / zoom,
        offsetY: moveDragRef.current.initY + dy / zoom,
      }));
    };
    const onUp = () => {
      moveDragRef.current.active = false;
      setIsMoving(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const revertEdit = (spanId) => {
    setEdits((prev) => { const n = { ...prev }; delete n[spanId]; return n; });
    if (selectedId === spanId) setSelectedId(null);
  };
  const clearEditsOnPage = () => {
    setEdits((prev) => {
      const next = {};
      for (const k in prev) if (prev[k].page !== currentPage) next[k] = prev[k];
      return next;
    });
  };
  const handleZoomIn = () => { setUserZoomed(true); setZoom((z) => Math.min(3.0, +(z + 0.2).toFixed(2))); };
  const handleZoomOut = () => { setUserZoomed(true); setZoom((z) => Math.max(0.2, +(z - 0.2).toFixed(2))); };
  const handleFitToScreen = () => setUserZoomed(false);

  // Save
  const handleSave = async () => {
    if (stateRef.current.selectedId) {
      try { flushSync(() => commitEdit()); } catch { commitEdit(); }
    }
    if (stateRef.current.editingAdditionId) {
      const addId = stateRef.current.editingAdditionId;
      const draft = stateRef.current.additionDraftText ?? '';
      setAdditions((prev) => prev.map((a) => (a.id === addId ? { ...a, text: draft } : a)));
      setEditingAdditionId(null);
    }
    await new Promise((r) => setTimeout(r, 0));

    const finalEdits = { ...stateRef.current.edits };
    const finalAdditions = stateRef.current.additions.slice();
    if (Object.keys(finalEdits).length === 0 && finalAdditions.length === 0) {
      setErrorMsg('Make at least one change before saving.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    try {
      const editPayload = Object.values(finalEdits).map((e) => ({
        page: e.page,
        bbox: e.bbox,
        offsetX: e.offsetX || 0,
        offsetY: e.offsetY || 0,
        originalText: e.originalText,
        newText: e.newText,
        fontName: e.fontName,
        originalFontName: e.originalFontName || null,
        preserveOriginalFont: Boolean(e.preserveOriginalFont),
        familyExplicit: Boolean(e.familyExplicit),
        bold: Boolean(e.bold),
        italic: Boolean(e.italic),
        fontSize: e.fontSize,
        color: e.color,
        align: e.align,
        underline: Boolean(e.underline),
        strike: Boolean(e.strike),
        superscript: Boolean(e.superscript),
        subscript: Boolean(e.subscript),
        charSpacing: e.charSpacing || 0,
        lineSpacing: e.lineSpacing || 1.15,
        hScale: e.hScale || 100,
        outlineColor: e.outlineColor || null,
        outlineWidth: e.outlineWidth || 0,
        direction: e.direction || 'auto',
      }));
      const addPayload = finalAdditions.map((a) => ({ ...a }));
      const output = await editPdfText(file, editPayload, addPayload);
      const url = URL.createObjectURL(output.blob);
      setResult({
        url, filename: output.filename,
        originalSize: output.originalSize, compressedSize: output.compressedSize,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save edited PDF.');
    } finally {
      setSaving(false);
    }
  };

  const handleContinueEditing = () => {
    if (result?.url) URL.revokeObjectURL(result.url);
    setResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleBack = () => {
    if (result?.url) URL.revokeObjectURL(result.url);
    onBack();
  };

  const totalEdits = Object.keys(edits).length + additions.filter((a) => a.page === currentPage).length;
  const pageHasSpans = spans.length > 0;

  // Sidebar label + state
  const selectedSpan = selectedId ? spans.find((s) => s.id === selectedId) : null;
  const selectedAddition = selectedAdditionId ? additions.find((a) => a.id === selectedAdditionId) : null;
  const selectionLabel =
    selectedSpan ? (selectedSpan.text || '').slice(0, 30)
    : selectedAddition?.type === 'text' ? (selectedAddition.text || 'New text').slice(0, 30)
    : null;
  const hasTextSelection =
    Boolean(selectedId) || (selectedAddition?.type === 'text');

  // =========================================================================
  // SUCCESS SCREEN
  // =========================================================================
  if (result) {
    return (
      <div className="bg-slate-50 min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
            <button onClick={handleBack} className="flex items-center space-x-1.5 text-slate-600 hover:text-slate-900 font-semibold text-sm px-3 py-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer">
              <ArrowLeft className="w-4 h-4" /><span>Back to Home</span>
            </button>
            <div className="flex items-center space-x-2">
              <div className={`w-8 h-8 rounded-lg ${tool.bg} ${tool.color} flex items-center justify-center`}>
                <tool.icon className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Edit PDF — Done</h2>
            </div>
            <div className="w-20" />
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="bg-white border border-slate-200 rounded-3xl p-10 max-w-md w-full text-center space-y-6 shadow-md">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center">
              <Check className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-xl font-black text-slate-900">PDF Updated Successfully</h3>
            <p className="text-xs text-slate-500 truncate">Generated file: <strong className="text-slate-800">{result.filename}</strong></p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs flex items-center justify-between">
              <span className="text-slate-500 font-semibold">{formatFileSize(result.originalSize)}</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <span className="text-emerald-700 font-bold">{formatFileSize(result.compressedSize)}</span>
            </div>
            <div className="flex flex-col gap-3 pt-1">
              <a href={result.url} download={result.filename}
                className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-md shadow-rose-600/20 flex items-center justify-center space-x-2 transition">
                <Download className="w-4 h-4" /><span>Download Edited PDF</span>
              </a>
              <button onClick={handleContinueEditing}
                className="w-full py-3 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-sm font-bold transition cursor-pointer flex items-center justify-center space-x-2">
                <Edit3 className="w-4 h-4" /><span>Continue Editing</span>
              </button>
              <button onClick={handleBack}
                className="w-full py-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition cursor-pointer">
                Return to Home
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // EDITOR
  // =========================================================================
  return (
    <div className="bg-slate-50 min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <button onClick={handleBack} className="flex items-center space-x-1.5 text-slate-600 hover:text-slate-900 font-semibold text-xs sm:text-sm px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer">
            <ArrowLeft className="w-4 h-4" /><span>Back to Home</span>
          </button>
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-lg ${tool.bg} ${tool.color} flex items-center justify-center`}>
              {tool && <tool.icon className="w-4 h-4" />}
            </div>
            <div className="hidden sm:block">
              <h2 className="text-sm font-bold text-slate-900 leading-none">Edit PDF</h2>
              <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[220px]">{file?.name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {totalEdits > 0 && (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold rounded-full">
                {totalEdits} change{totalEdits === 1 ? '' : 's'}
              </span>
            )}
            <button onClick={handleSave} disabled={saving || totalEdits === 0}
              className="px-3 sm:px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm flex items-center space-x-1.5 transition cursor-pointer">
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Saving...</span></> : <><Download className="w-3.5 h-3.5" /><span>Save &amp; Download</span></>}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-3 sm:px-4 py-4 sm:py-6 flex flex-col space-y-3">
        {errorMsg && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="flex-1 font-medium">{errorMsg}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Viewer */}
          <div ref={viewerOuterRef}
            className="lg:col-span-9 bg-slate-200/60 rounded-3xl border border-slate-200 p-2 sm:p-4 flex flex-col items-center justify-center relative overflow-hidden h-[calc(100vh-160px)] min-h-[420px]">
            {pageDataUrl && !rendering && !loading && <ToolsBar toolMode={toolMode} setToolMode={setToolMode} />}

            {loading || rendering ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-3 text-slate-500">
                <Loader2 className="w-9 h-9 animate-spin text-rose-500" />
                <p className="text-xs font-semibold">{loading ? 'Loading document…' : 'Rendering page…'}</p>
              </div>
            ) : loadFailed ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-3 text-slate-500">
                <FileImage className="w-10 h-10 text-slate-400" />
                <p className="text-xs font-semibold">Unable to display this PDF.</p>
              </div>
            ) : pageDataUrl ? (
              <div className="relative bg-white shadow-xl rounded-md overflow-auto max-w-full max-h-full">
                <div ref={pageContainerRef}
                  style={{
                    position: 'relative',
                    width: `${pageDims.width}px`,
                    height: `${pageDims.height}px`,
                    flexShrink: 0,
                    cursor: toolMode ? 'crosshair' : 'default',
                  }}
                  onMouseDown={handlePageMouseDown}
                >
                  <img src={pageDataUrl} alt={`Page ${currentPage}`} draggable={false}
                    style={{
                      position: 'absolute', top: 0, left: 0,
                      width: `${pageDims.width}px`, height: `${pageDims.height}px`,
                      maxWidth: 'none', maxHeight: 'none',
                      display: 'block', userSelect: 'none', pointerEvents: 'none',
                    }}
                  />

                  {/* Existing-span overlay */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0,
                    width: `${pageDims.width}px`, height: `${pageDims.height}px`,
                  }}>
                    {spans.map((span) => {
                      const edit = edits[span.id];
                      const isSelected = selectedId === span.id;
                      const isModified = Boolean(edit);

                      // Cover at ORIGINAL position
                      const origLineH = span.fontPx * 1.15;
                      const origBaseFromTop = getBaselineFromTop(span.cssFont, span.fontPx, origLineH);
                      const origLeft = span.canvasX;
                      const origTop = span.canvasYBaseline - origBaseFromTop;
                      const origWidth = Math.max(span.widthPx, 12);

                      const coverNode = (isSelected || isModified) && (
                        <div key={`${span.id}-cover`} className="absolute z-20 bg-white rounded-[2px] pointer-events-none"
                          style={{ left: `${origLeft - 3}px`, top: `${origTop - 3}px`, width: `${origWidth + 6}px`, height: `${origLineH + 6}px` }} />
                      );

                      const displayStyle = isSelected ? activeStyle : edit ? {
                        fontFamily: edit.overrideFontFamily, fontSize: edit.overrideFontSize,
                        bold: edit.overrideBold, italic: edit.overrideItalic,
                        underline: edit.overrideUnderline, strike: edit.overrideStrike,
                        superscript: edit.overrideSuperscript, subscript: edit.overrideSubscript,
                        color: edit.overrideColor, align: edit.overrideAlign,
                        lineSpacing: edit.overrideLineSpacing, charSpacing: edit.overrideCharSpacing,
                        hScale: edit.overrideHScale,
                        outlineColor: edit.overrideOutlineColor, outlineWidth: edit.overrideOutlineWidth,
                        direction: edit.overrideDirection,
                        offsetX: edit.offsetX, offsetY: edit.offsetY,
                      } : null;

                      const eff = getEffectiveStyle(span, displayStyle);
                      const cssFont = cssStackFor(span, displayStyle);
                      const offsetPx = { x: eff.offsetX * zoom, y: eff.offsetY * zoom };
                      const fontPx = eff.size * zoom;
                      const baselinePx = span.canvasYBaseline + offsetPx.y - eff.baselineShiftPt * zoom;
                      const lineHeightMult = eff.lineSpacing ?? 1.15;
                      const lineHeightPx = fontPx * lineHeightMult;
                      const baseFromTop = getBaselineFromTop(cssFont, fontPx, lineHeightPx);

                      // ---- Alignment box: page-wide when align != left ----
                      const effAlign = eff.align || 'left';
                      const useWideBox = effAlign === 'center' || effAlign === 'right' || effAlign === 'justify';

                      let boxLeft, boxWidth;
                      if (useWideBox) {
                        boxLeft = 4;
                        boxWidth = pageDims.width - 8;
                      } else {
                        const scaleFactor = fontPx / Math.max(span.fontPx, 1);
                        boxLeft = span.canvasX + offsetPx.x;
                        boxWidth = Math.max(span.widthPx * scaleFactor, 12);
                      }
                      const top = baselinePx - baseFromTop;

                      const displayText = isModified ? edit.newText : span.text;

                      const hScaleRatio = (eff.hScale ?? 100) / 100;
                      const decorations = [];
                      if (eff.underline) decorations.push('underline');
                      if (eff.strike) decorations.push('line-through');

                      const textStyle = {
                        left: `${boxLeft}px`,
                        top: `${top}px`,
                        width: `${boxWidth}px`,
                        height: `${lineHeightPx}px`,
                        lineHeight: `${lineHeightPx}px`,
                        fontSize: `${fontPx}px`,
                        fontFamily: cssFont,
                        fontWeight: eff.bold ? 'bold' : 'normal',
                        fontStyle: eff.italic ? 'italic' : 'normal',
                        textDecoration: decorations.length ? decorations.join(' ') : 'none',
                        color: rgbToCss(eff.color),
                        textAlign: effAlign,
                        letterSpacing: eff.charSpacing ? `${eff.charSpacing * zoom}px` : 'normal',
                        direction: eff.direction === 'rtl' ? 'rtl' : 'ltr',
                        whiteSpace: 'pre',
                        padding: 0, margin: 0, boxSizing: 'border-box',
                        transform: hScaleRatio !== 1 ? `scaleX(${hScaleRatio})` : undefined,
                        transformOrigin: 'left top',
                        WebkitTextStroke:
                          eff.outlineColor && eff.outlineWidth > 0
                            ? `${eff.outlineWidth * zoom}px ${rgbToCss(eff.outlineColor)}`
                            : undefined,
                      };

                      if (isSelected) {
                        return (
                          <React.Fragment key={span.id}>
                            {coverNode}
                            <div data-in-edit-box="1" className="absolute z-30"
                              style={{ ...textStyle, outline: isMoving ? '1.5px dashed #3b82f6' : '1.5px solid #3b82f6', outlineOffset: '0px' }}>
                              <TextEditBox
                                initialText={draftText}
                                onInput={(v) => setDraftText(typeof v === 'string' ? v : '')}
                                onCommit={commitEdit} onCancel={cancelEdit}
                                style={{
                                  position: 'absolute', left: 0, top: 0, width: '100%', height: '100%',
                                  padding: 0, margin: 0, border: 'none', outline: 'none',
                                  backgroundColor: 'transparent',
                                  fontFamily: cssFont, fontSize: `${fontPx}px`,
                                  fontWeight: eff.bold ? 'bold' : 'normal',
                                  fontStyle: eff.italic ? 'italic' : 'normal',
                                  textDecoration: decorations.length ? decorations.join(' ') : 'none',
                                  color: rgbToCss(eff.color),
                                  textAlign: effAlign,
                                  letterSpacing: eff.charSpacing ? `${eff.charSpacing * zoom}px` : 'normal',
                                  lineHeight: `${lineHeightPx}px`,
                                  boxSizing: 'border-box', whiteSpace: 'pre',
                                  overflow: 'visible', cursor: isMoving ? 'move' : 'text',
                                }}
                              />
                            </div>
                          </React.Fragment>
                        );
                      }

                      if (isModified) {
                        if (edit.newText === '') {
                          return (
                            <React.Fragment key={span.id}>
                              {coverNode}
                              <div className="absolute z-30 cursor-text group" style={textStyle}
                                onClick={() => beginEdit(span)} title="Deleted — click to edit">
                                <span className="hidden group-hover:flex absolute inset-0 items-center justify-center text-[10px] font-bold text-rose-500 bg-rose-50/80 rounded-[2px]">deleted</span>
                              </div>
                            </React.Fragment>
                          );
                        }
                        return (
                          <React.Fragment key={span.id}>
                            {coverNode}
                            <div className="absolute z-30 cursor-text group"
                              style={textStyle}
                              onClick={() => beginEdit(span)} title="Click to edit">
                              <span className="relative block">{String(displayText ?? '') || '\u00A0'}</span>
                              {!useWideBox && (
                                <span className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center w-4 h-4 bg-blue-600 text-white rounded-full text-[10px] font-bold">✎</span>
                              )}
                            </div>
                          </React.Fragment>
                        );
                      }

                      return (
                        <div key={span.id}
                          className="absolute z-10 cursor-text hover:bg-blue-500/15 rounded-[2px] transition-colors"
                          style={textStyle}
                          onClick={() => beginEdit(span)} title="Click to edit" />
                      );
                    })}
                  </div>

                  {/* Additions overlay */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0,
                    width: `${pageDims.width}px`, height: `${pageDims.height}px`,
                    pointerEvents: 'none',
                  }}>
                    {additions.filter((a) => a.page === currentPage).map((add) => {
                      const [cx0, cy0] = pdfXYToCanvas(add.bbox.x0, add.bbox.y0, viewportTransform, pageView);
                      const [cx1, cy1] = pdfXYToCanvas(add.bbox.x1, add.bbox.y1, viewportTransform, pageView);
                      const left = Math.min(cx0, cx1);
                      const top = Math.min(cy0, cy1);
                      const width = Math.max(1, Math.abs(cx1 - cx0));
                      const height = Math.max(1, Math.abs(cy1 - cy0));
                      const isSel = selectedAdditionId === add.id;
                      const isEditing = editingAdditionId === add.id;

                      if (add.type === 'text') {
                        const fontPx = (add.fontSize || 14) * zoom;
                        const lineHeightMult = add.lineSpacing ?? 1.15;
                        const lineHeightPx = fontPx * lineHeightMult;
                        const cssFont = cssStackFromFamily(add.fontName || 'Helvetica');
                        const baseFromTop = getBaselineFromTop(cssFont, fontPx, lineHeightPx);
                        const [tx, tyBase] = pdfXYToCanvas(add.bbox.x0, add.bbox.y1, viewportTransform, pageView);
                        const textTop = tyBase - baseFromTop;
                        const minTextW = Math.max(60, (add.text?.length || 4) * fontPx * 0.55);

                        const decorations = [];
                        if (add.underline) decorations.push('underline');
                        if (add.strike) decorations.push('line-through');

                        const addAlign = add.align || 'left';
                        const useAddWideBox =
                          addAlign === 'center' || addAlign === 'right' || addAlign === 'justify';
                        const addBoxLeft = useAddWideBox ? 4 : tx - 4;
                        const addBoxWidth = useAddWideBox
                          ? pageDims.width - 8
                          : Math.max(minTextW, 40);

                        return (
                          <div key={add.id} data-addition-node="1"
                            style={{
                              position: 'absolute',
                              left: `${addBoxLeft}px`,
                              top: `${textTop - 4}px`,
                              minWidth: `${addBoxWidth}px`,
                              width: useAddWideBox ? `${addBoxWidth}px` : undefined,
                              height: `${lineHeightPx + 8}px`,
                              pointerEvents: 'auto',
                              cursor: isEditing ? 'text' : 'move',
                              outline: isSel ? '1.5px solid #3b82f6' : '1px dashed rgba(59,130,246,0.35)',
                              outlineOffset: '0px',
                              background: 'rgba(59,130,246,0.04)',
                              borderRadius: '3px',
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              if (editingAdditionId === add.id) return;
                              if (selectedAdditionId !== add.id) beginEditAddition(add);
                              handleAdditionDragStart(e, add.id, 'move');
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingAdditionId(add.id);
                              setAdditionDraftText(add.text || '');
                            }}
                          >
                            {isEditing ? (
                              <TextEditBox
                                initialText={additionDraftText}
                                onInput={setAdditionDraftText}
                                onCommit={(v) => { updateAddition(add.id, { text: v }); setEditingAdditionId(null); }}
                                onCancel={() => setEditingAdditionId(null)}
                                onMouseDownInternal={(e) => e.stopPropagation()}
                                style={{
                                  position: 'absolute', left: '4px', top: '4px',
                                  minWidth: '60px', minHeight: `${lineHeightPx}px`,
                                  padding: 0, margin: 0, border: 'none',
                                  outline: 'none', background: 'white',
                                  fontFamily: cssFont, fontSize: `${fontPx}px`,
                                  fontWeight: add.bold ? 'bold' : 'normal',
                                  fontStyle: add.italic ? 'italic' : 'normal',
                                  textDecoration: decorations.length ? decorations.join(' ') : 'none',
                                  color: rgbToCss(add.color || [0, 0, 0]),
                                  textAlign: addAlign,
                                  lineHeight: `${lineHeightPx}px`, whiteSpace: 'pre',
                                  boxSizing: 'border-box', cursor: 'text',
                                }}
                              />
                            ) : (
                              <span
                                style={{
                                  position: 'absolute', left: '4px', top: '4px',
                                  right: '4px',
                                  fontFamily: cssFont, fontSize: `${fontPx}px`,
                                  fontWeight: add.bold ? 'bold' : 'normal',
                                  fontStyle: add.italic ? 'italic' : 'normal',
                                  textDecoration: decorations.length ? decorations.join(' ') : 'none',
                                  color: rgbToCss(add.color || [0, 0, 0]),
                                  textAlign: addAlign,
                                  lineHeight: `${lineHeightPx}px`,
                                  whiteSpace: 'pre', pointerEvents: 'none',
                                }}
                              >
                                {String(add.text || '') || 'Double-click to edit'}
                              </span>
                            )}
                            {isSel && !isEditing && !useAddWideBox && (
                              <>
                                {['nw','ne','sw','se'].map((h) => {
                                  const pos = {
                                    nw: '-top-1.5 -left-1.5 cursor-nwse-resize',
                                    ne: '-top-1.5 -right-1.5 cursor-nesw-resize',
                                    sw: '-bottom-1.5 -left-1.5 cursor-nesw-resize',
                                    se: '-bottom-1.5 -right-1.5 cursor-nwse-resize',
                                  }[h];
                                  return (
                                    <div key={h}
                                      onMouseDown={(e) => { e.stopPropagation(); handleAdditionDragStart(e, add.id, 'resize', h); }}
                                      className={`absolute w-2.5 h-2.5 bg-white border-2 border-blue-600 rounded-sm shadow ${pos}`} />
                                  );
                                })}
                              </>
                            )}
                          </div>
                        );
                      }

                      // Shape
                      return (
                        <div key={add.id} data-addition-node="1"
                          style={{
                            position: 'absolute',
                            left: `${left}px`, top: `${top}px`,
                            width: `${width}px`, height: `${height}px`,
                            pointerEvents: 'auto', cursor: 'move',
                            outline: isSel ? '1.5px solid #3b82f6' : '1px dashed rgba(59,130,246,0.35)',
                            outlineOffset: '0px',
                            background: 'transparent',
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setSelectedAdditionId(add.id);
                            setSelectedId(null);
                            setEditingAdditionId(null);
                            handleAdditionDragStart(e, add.id, 'move');
                          }}
                        >
                          <ShapeRenderer
                            shapeType={add.shapeType}
                            strokeColor={add.strokeColor || [0, 0, 0]}
                            strokeWidth={add.strokeWidth ?? 2}
                            fillColor={add.fillColor}
                          />
                          {isSel && (
                            <>
                              {['nw','ne','sw','se'].map((h) => {
                                const pos = {
                                  nw: '-top-1.5 -left-1.5 cursor-nwse-resize',
                                  ne: '-top-1.5 -right-1.5 cursor-nesw-resize',
                                  sw: '-bottom-1.5 -left-1.5 cursor-nesw-resize',
                                  se: '-bottom-1.5 -right-1.5 cursor-nwse-resize',
                                }[h];
                                return (
                                  <div key={h}
                                    onMouseDown={(e) => { e.stopPropagation(); handleAdditionDragStart(e, add.id, 'resize', h); }}
                                    className={`absolute w-2.5 h-2.5 bg-white border-2 border-blue-600 rounded-sm shadow ${pos}`} />
                                );
                              })}
                            </>
                          )}
                        </div>
                      );
                    })}

                    {drawingRect && (
                      <div
                        style={{
                          position: 'absolute',
                          left: `${Math.min(drawingRect.startX, drawingRect.currentX)}px`,
                          top: `${Math.min(drawingRect.startY, drawingRect.currentY)}px`,
                          width: `${Math.abs(drawingRect.currentX - drawingRect.startX)}px`,
                          height: `${Math.abs(drawingRect.currentY - drawingRect.startY)}px`,
                          border: '1.5px dashed #3b82f6',
                          background: 'rgba(59,130,246,0.1)',
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-32 space-y-3 text-slate-500">
                <FileImage className="w-10 h-10 text-slate-400" />
                <p className="text-xs font-semibold">Nothing to display.</p>
              </div>
            )}

            {/* Floating page controls */}
            {pageDataUrl && !rendering && !loading && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-2xl flex items-center space-x-2 text-xs shadow-xl z-40">
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}
                  className="p-1 hover:bg-slate-700 rounded-lg disabled:opacity-30 cursor-pointer">
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
                  className="p-1 hover:bg-slate-700 rounded-lg disabled:opacity-30 cursor-pointer">
                  <ChevronDown className="w-4 h-4" />
                </button>
                <div className="h-4 w-px bg-slate-600" />
                <span className="font-bold px-1.5 py-0.5 bg-slate-700 rounded">{currentPage}</span>
                <span className="text-slate-400">/ {totalPages}</span>
                <div className="h-4 w-px bg-slate-600" />
                <button onClick={handleZoomOut} className="p-1 hover:bg-slate-700 rounded-lg cursor-pointer">
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleZoomIn} className="p-1 hover:bg-slate-700 rounded-lg cursor-pointer">
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-slate-300 font-semibold">{Math.round(zoom * 100)}%</span>
                <button onClick={handleFitToScreen} className="p-1 hover:bg-slate-700 rounded-lg cursor-pointer text-slate-300" title="Fit to screen">
                  <Maximize className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Right column — Format sidebar */}
          <div className="lg:col-span-3 space-y-3" data-format-sidebar="1">
            <TextFormatSidebar
              activeStyle={activeStyle}
              onChange={handleStyleChange}
              isActive={hasTextSelection}
              selectionLabel={selectionLabel}
              onDelete={hasTextSelection ? handleDeleteSelected : undefined}
            />

            {totalEdits > 0 && (
              <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-900 text-sm">Changes on this page</h3>
                  <button onClick={() => { clearEditsOnPage(); setAdditions((prev) => prev.filter((a) => a.page !== currentPage)); }}
                    className="text-[10px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer">
                    Clear page
                  </button>
                </div>
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {Object.entries(edits).filter(([, e]) => e.page === currentPage).map(([id, e]) => (
                    <div key={id} className="p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-2 text-[11px]">
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-400 truncate">Was: {String(e.originalText ?? '')}</p>
                        <p className="text-slate-800 font-semibold truncate">Now: {typeof e.newText === 'string' && e.newText ? e.newText : '∅ (deleted)'}</p>
                      </div>
                      <button onClick={() => revertEdit(id)} className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer shrink-0" title="Revert">
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {additions.filter((a) => a.page === currentPage).map((a) => (
                    <div key={a.id} className="p-2 bg-blue-50/50 border border-blue-200 rounded-xl flex items-start justify-between gap-2 text-[11px]">
                      <div className="flex-1 min-w-0">
                        <p className="text-blue-500 font-bold uppercase text-[9px]">New {a.type}</p>
                        <p className="text-slate-800 font-semibold truncate">
                          {a.type === 'text' ? (a.text || '∅') : `Shape: ${a.shapeType}`}
                        </p>
                      </div>
                      <button onClick={() => deleteAddition(a.id)} className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer shrink-0" title="Delete">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-sky-50 border border-sky-200 rounded-3xl p-3 text-[11px] text-sky-900 flex items-start space-x-2">
              <Info className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Bold, italic, underline, strikethrough, super/subscript, spacing, alignment
                and colour are all written into the final PDF.
              </p>
            </div>
          </div>
        </div>
      </main>

      {selectedId && !result && (
        <QuickActionsToolbar
          onDelete={handleDeleteText}
          onMoveStart={handleMoveStart}
          position={toolbarPos}
        />
      )}

      {selectedAddition && selectedAddition.type === 'shape' && !result && (
        <ShapeToolbar
          addition={selectedAddition}
          onChange={(patch) => updateAddition(selectedAddition.id, patch)}
          onDelete={() => deleteAddition(selectedAddition.id)}
          onMoveStart={(e) => handleAdditionDragStart(e, selectedAddition.id, 'move')}
          position={additionToolbarPos}
        />
      )}
    </div>
  );
}