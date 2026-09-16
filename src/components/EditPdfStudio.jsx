import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Loader2,
  ChevronUp,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Maximize,
  Type,
  AlertCircle,
  Info,
  Check,
  MousePointerClick,
  RotateCcw,
  Download,
  ArrowRight,
  FileImage,
  Edit3,
  GripVertical,
  Trash2,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { editPdfText, checkPdfPassword } from '../utils/pdfWorker';

// ---------------------------------------------------------------------------
// PDF.js worker
// ---------------------------------------------------------------------------
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

// ---------------------------------------------------------------------------
// Color palette for the toolbar
// ---------------------------------------------------------------------------
const COLOR_PALETTE = [
  [0, 0, 0],
  [0.25, 0.25, 0.25],
  [0.5, 0.5, 0.5],
  [0.75, 0.75, 0.75],
  [1, 1, 1],
  [0.86, 0.15, 0.15],
  [0.95, 0.42, 0.1],
  [0.95, 0.75, 0.1],
  [0.1, 0.65, 0.3],
  [0.1, 0.5, 0.9],
  [0.5, 0.2, 0.8],
  [0.85, 0.2, 0.6],
  [0.1, 0.2, 0.5],
  [0.1, 0.5, 0.5],
  [0.5, 0.3, 0.2],
  [0.95, 0.95, 0.95],
];

// ---------------------------------------------------------------------------
// Font parsing helpers
// ---------------------------------------------------------------------------
function parseFontFallback(rawName) {
  const name = (rawName || 'Helvetica').replace(/^[A-Z]{6}\+/, '');
  const isBold = /bold|black|heavy|semibold|demibold|extrabold/i.test(name);
  const isItalic = /italic|oblique/i.test(name);

  let family = '';
  let cssFallback = 'sans-serif';

  if (/times|serif|roman|georgia|garamond|book|minion/i.test(name)) {
    family = '"Times New Roman", Times, "Liberation Serif", Georgia, serif';
    cssFallback = 'serif';
  } else if (/courier|mono|consol|menlo/i.test(name)) {
    family = '"Courier New", Courier, "Liberation Mono", monospace';
    cssFallback = 'monospace';
  } else if (/arial|helvetica|helv/i.test(name)) {
    family = 'Arial, Helvetica, "Liberation Sans", sans-serif';
  } else if (/calibri/i.test(name)) {
    family = 'Calibri, "Segoe UI", "Carlito", Arial, sans-serif';
  } else if (/cambria/i.test(name)) {
    family = 'Cambria, "Liberation Serif", Georgia, serif';
    cssFallback = 'serif';
  } else if (/verdana/i.test(name)) {
    family = 'Verdana, Geneva, sans-serif';
  } else if (/tahoma/i.test(name)) {
    family = 'Tahoma, Verdana, sans-serif';
  } else if (/segoe/i.test(name)) {
    family = '"Segoe UI", Tahoma, Arial, sans-serif';
  } else if (/roboto/i.test(name)) {
    family = 'Roboto, "Helvetica Neue", Arial, sans-serif';
  } else if (/open\s*sans/i.test(name)) {
    family = '"Open Sans", "Segoe UI", Arial, sans-serif';
  } else if (/lato/i.test(name)) {
    family = 'Lato, "Segoe UI", Arial, sans-serif';
  } else if (/symbol/i.test(name)) {
    family = 'Symbol';
  } else if (/zapf|dingbat/i.test(name)) {
    family = '"Zapf Dingbats"';
  } else {
    family = 'Helvetica, Arial, sans-serif';
  }

  return { family, isBold, isItalic, cssFallback };
}

// Turn a user-picked font family ("Times", "Helvetica", "Courier")
// into a real CSS font stack with sensible fallbacks.
function cssStackFromFamily(family) {
  const f = (family || '').toLowerCase();
  if (f.includes('times')) {
    return '"Times New Roman", Times, "Liberation Serif", Georgia, serif';
  }
  if (f.includes('courier')) {
    return '"Courier New", Courier, "Liberation Mono", monospace';
  }
  if (f.includes('helvetica') || f.includes('arial')) {
    return 'Arial, Helvetica, "Liberation Sans", sans-serif';
  }
  return 'Arial, Helvetica, sans-serif';
}

function getRealFontName(page, fontId) {
  try {
    if (!page?.commonObjs?.has?.(fontId)) return null;
    const fontObj = page.commonObjs.get(fontId);
    const rawName = fontObj?.name || '';
    if (!rawName) return null;
    return rawName.replace(/^[A-Z]{6}\+/, '') || null;
  } catch {
    return null;
  }
}

function rgbToCss(rgb) {
  return `rgb(${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)})`;
}

function formatFileSize(bytes) {
  if (!bytes) return '0 KB';
  const k = 1024;
  if (bytes < k * k) return `${(bytes / k).toFixed(1)} KB`;
  return `${(bytes / (k * k)).toFixed(2)} MB`;
}

// ---------------------------------------------------------------------------
// Font-metric baseline measurement
// ---------------------------------------------------------------------------
const _baselineCache = {};
function getBaselineFromTop(cssFont, fontPx, lineHeightPx) {
  const key = `${cssFont}|${fontPx.toFixed(2)}|${lineHeightPx.toFixed(2)}`;
  const cached = _baselineCache[key];
  if (cached !== undefined) return cached;

  try {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${fontPx}px ${cssFont}`;
    const m = ctx.measureText('Hgjy|');
    const asc = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent ?? fontPx * 0.75;
    const desc = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent ?? fontPx * 0.25;
    const baselineFromTop = (lineHeightPx - (asc + desc)) / 2 + asc;
    _baselineCache[key] = baselineFromTop;
    return baselineFromTop;
  } catch {
    const fallback = lineHeightPx / 2 + fontPx * 0.3;
    _baselineCache[key] = fallback;
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Sample dominant ink color from a small patch around a span
// ---------------------------------------------------------------------------
function sampleSpanColor(ctx, span) {
  const cx = span.canvasX + span.widthPx * 0.5;
  const cy = span.canvasYBaseline - span.fontPx * 0.35;

  const patch = 5;
  const px = Math.max(0, Math.min(ctx.canvas.width - patch, Math.round(cx - patch / 2)));
  const py = Math.max(0, Math.min(ctx.canvas.height - patch, Math.round(cy - patch / 2)));

  try {
    const data = ctx.getImageData(px, py, patch, patch).data;
    let bestRgb = [0, 0, 0];
    let bestDist = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 40) continue;
      const dist = Math.abs(255 - r) + Math.abs(255 - g) + Math.abs(255 - b);
      if (dist > bestDist) {
        bestDist = dist;
        bestRgb = [r, g, b];
      }
    }
    return [bestRgb[0] / 255, bestRgb[1] / 255, bestRgb[2] / 255];
  } catch {
    return [0, 0, 0];
  }
}

// ---------------------------------------------------------------------------
// In-place text editor — contentEditable <div>
// ---------------------------------------------------------------------------
function TextEditBox({ initialText, style, onInput, onCommit, onCancel }) {
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
    } catch {
      /* ignore */
    }

    el.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleBlur = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCommit(ref.current?.textContent ?? '');
  };

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      onInput={(e) => onInput?.(e.currentTarget.textContent ?? '')}
      style={style}
    />
  );
}

// ---------------------------------------------------------------------------
// Floating formatting toolbar
// ---------------------------------------------------------------------------
function TextFormatToolbar({
  activeStyle,
  onChange,
  onDelete,
  onMoveStart,
  onMoveEnd,
  position,
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  const currentColor = activeStyle.color || [0, 0, 0];

  return (
    <div
      className="fixed z-[9999] flex items-center gap-1 px-2 py-1.5 bg-slate-900/95 backdrop-blur-md text-white rounded-xl shadow-2xl border border-slate-700/60 select-none"
      style={{ left: position.x, top: position.y }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Move grip */}
      <button
        type="button"
        title="Drag to move"
        onPointerDown={onMoveStart}
        onPointerUp={onMoveEnd}
        className="p-1 rounded hover:bg-slate-700 cursor-grab active:cursor-grabbing text-slate-300"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      <div className="w-px h-4 bg-slate-700" />

      {/* Font family */}
      <select
        value={activeStyle.fontFamily || ''}
        onChange={(e) => onChange({ ...activeStyle, fontFamily: e.target.value || null })}
        className="bg-slate-800 text-white text-[11px] font-medium rounded-md px-1.5 py-1 border border-slate-700 outline-none cursor-pointer"
        title="Font family"
      >
        <option value="">Original</option>
        <option value="Helvetica">Helvetica / Arial</option>
        <option value="Times">Times New Roman</option>
        <option value="Courier">Courier</option>
      </select>

      {/* Font size */}
      <input
        type="number"
        min="4"
        max="200"
        placeholder="Size"
        value={activeStyle.fontSize ?? ''}
        onChange={(e) =>
          onChange({
            ...activeStyle,
            fontSize: e.target.value === '' ? null : Number(e.target.value),
          })
        }
        className="w-12 bg-slate-800 text-white text-[11px] font-medium rounded-md px-1.5 py-1 border border-slate-700 outline-none text-center"
        title="Font size"
      />

      <div className="w-px h-4 bg-slate-700" />

      {/* Bold / Italic / Underline */}
      <button
        type="button"
        title="Bold"
        onClick={() =>
          onChange({
            ...activeStyle,
            bold: !(activeStyle.bold ?? false),
          })
        }
        className={`w-7 h-7 rounded-md flex items-center justify-center text-[13px] font-bold transition ${
          activeStyle.bold ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
        }`}
      >
        B
      </button>
      <button
        type="button"
        title="Italic"
        onClick={() =>
          onChange({
            ...activeStyle,
            italic: !(activeStyle.italic ?? false),
          })
        }
        className={`w-7 h-7 rounded-md flex items-center justify-center text-[13px] italic font-serif transition ${
          activeStyle.italic ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
        }`}
      >
        I
      </button>
      <button
        type="button"
        title="Underline"
        onClick={() =>
          onChange({
            ...activeStyle,
            underline: !activeStyle.underline,
          })
        }
        className={`w-7 h-7 rounded-md flex items-center justify-center text-[13px] underline transition ${
          activeStyle.underline ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
        }`}
      >
        U
      </button>

      <div className="w-px h-4 bg-slate-700" />

      {/* Color */}
      <div className="relative">
        <button
          type="button"
          title="Text color"
          onClick={() => setPaletteOpen((v) => !v)}
          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-slate-700 transition"
        >
          <span
            className="w-4 h-4 rounded border border-slate-500 shadow-inner"
            style={{ background: rgbToCss(currentColor) }}
          />
        </button>

        {paletteOpen && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl grid grid-cols-4 gap-1.5 z-[10000]">
            {COLOR_PALETTE.map((c, i) => {
              const isActive =
                Math.abs(c[0] - currentColor[0]) < 0.01 &&
                Math.abs(c[1] - currentColor[1]) < 0.01 &&
                Math.abs(c[2] - currentColor[2]) < 0.01;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onChange({ ...activeStyle, color: c });
                    setPaletteOpen(false);
                  }}
                  className={`w-5 h-5 rounded-md border transition hover:scale-110 ${
                    isActive ? 'border-blue-400 ring-2 ring-blue-500/50' : 'border-slate-600'
                  }`}
                  style={{ background: rgbToCss(c) }}
                  title={`RGB ${c.map((v) => Math.round(v * 255)).join(', ')}`}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-slate-700" />

      {/* Delete */}
      <button
        type="button"
        title="Delete text"
        onClick={onDelete}
        className="w-7 h-7 rounded-md flex items-center justify-center text-red-300 hover:bg-red-600 hover:text-white transition"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Effective-style helpers
// ---------------------------------------------------------------------------
function getEffectiveStyle(span, style) {
  const family = style?.fontFamily || span.fontFamily;
  const size = style?.fontSize ?? span.pdfFontSize;
  const bold = style?.bold !== null && style?.bold !== undefined ? style.bold : span.isBold;
  const italic =
    style?.italic !== null && style?.italic !== undefined ? style.italic : span.isItalic;
  const underline = Boolean(style?.underline);
  const color = style?.color || span.color;
  const offsetX = style?.offsetX || 0;
  const offsetY = style?.offsetY || 0;
  return { family, size, bold, italic, underline, color, offsetX, offsetY };
}

// Build a CSS font stack — when the user has picked a family we use that
// family's stack, otherwise we use PDF.js's own subset-based stack.
function cssStackFor(span, style) {
  if (style?.fontFamily) return cssStackFromFamily(style.fontFamily);
  return span.cssFont;
}

// Compose the effective font name string that will be sent to the backend.
// The backend's resolve_font_code() reads bold/italic keywords from this string.
function composeBackendFontName(span, style) {
  if (style?.fontFamily) {
    const bold = style.bold !== null && style.bold !== undefined ? style.bold : span.isBold;
    const italic =
      style.italic !== null && style.italic !== undefined ? style.italic : span.isItalic;
    let name = style.fontFamily;
    if (bold && italic) name += '-BoldItalic';
    else if (bold) name += '-Bold';
    else if (italic) name += '-Italic';
    return name;
  }
  return span.fontRaw;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function EditPdfStudio({ tool, file, onBack }) {
  const pdfDocRef = useRef(null);
  const viewerOuterRef = useRef(null);
  const pageContainerRef = useRef(null);
  const moveDragRef = useRef({ active: false, startX: 0, startY: 0, initX: 0, initY: 0 });

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

  const [spans, setSpans] = useState([]);
  const [edits, setEdits] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [draftText, setDraftText] = useState('');
  const [activeStyle, setActiveStyle] = useState({
    fontFamily: null,
    fontSize: null,
    bold: null,
    italic: null,
    underline: false,
    color: null,
    offsetX: 0,
    offsetY: 0,
  });

  const [toolbarPos, setToolbarPos] = useState({ x: -9999, y: -9999 });
  const [isMoving, setIsMoving] = useState(false);

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const [viewerSize, setViewerSize] = useState({ w: 0, h: 0 });

  // -------------------------------------------------------------------------
  // Reset per-file state
  // -------------------------------------------------------------------------
  useEffect(() => {
    setUserZoomed(false);
    setZoom(0.5);
    setNaturalPageSize({ width: 0, height: 0 });
    setEdits({});
    setSelectedId(null);
  }, [file]);

  // -------------------------------------------------------------------------
  // Viewer size tracking
  // -------------------------------------------------------------------------
  useEffect(() => {
    const el = viewerOuterRef.current;
    if (!el) return;

    const update = () => setViewerSize({ w: el.clientWidth, h: el.clientHeight });
    update();

    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(el);
    }
    window.addEventListener('resize', update);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [loading, loadFailed, result]);

  // -------------------------------------------------------------------------
  // Auto-fit to screen
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (userZoomed || result) return;
    if (!naturalPageSize.width || !naturalPageSize.height) return;
    if (!viewerSize.w || !viewerSize.h) return;

    const availW = viewerSize.w - 40;
    const availH = viewerSize.h - 68;
    if (availW <= 0 || availH <= 0) return;

    const fitZoom = Math.min(availW / naturalPageSize.width, availH / naturalPageSize.height);
    const clamped = Math.max(0.2, Math.min(3.0, fitZoom));

    if (Math.abs(clamped - zoom) > 0.01) setZoom(clamped);
  }, [naturalPageSize, viewerSize, userZoomed, zoom, result]);

  // -------------------------------------------------------------------------
  // Load PDF once
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    pdfDocRef.current = null;
    setLoading(true);
    setLoadFailed(false);
    setErrorMsg('');

    (async () => {
      try {
        if (!file) {
          setLoading(false);
          setLoadFailed(true);
          return;
        }
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

    return () => {
      cancelled = true;
    };
  }, [file]);

  // -------------------------------------------------------------------------
  // Render page + extract spans
  // -------------------------------------------------------------------------
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
            for (const f of document.fonts) {
              if (f.family === fontName) {
                found = true;
                break;
              }
            }
            if (
              !found &&
              page.commonObjs &&
              page.commonObjs.has &&
              page.commonObjs.has(fontName)
            ) {
              const fontObj = page.commonObjs.get(fontName);
              const fontData = fontObj?.data;
              if (fontData) {
                const face = new FontFace(fontName, fontData);
                await face.load();
                document.fonts.add(face);
              }
            }
          } catch {
            /* ignore */
          }
        }

        try {
          await document.fonts.ready;
        } catch {
          /* ignore */
        }

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
            id: `s-${currentPage}-${idx++}`,
            page: currentPage,
            text: item.str,
            canvasX,
            canvasYBaseline,
            fontPx,
            widthPx,
            pdfX,
            pdfYBaselineTopDown: yBaselineTopDownPdf,
            pdfFontSize: fontSize,
            pdfWidth: item.width || 0,
            fontRaw: rawFont,
            fontName: item.fontName,
            fontFamily: fallback.family,
            isBold: fallback.isBold,
            isItalic: fallback.isItalic,
            cssFont: cssFontStack,
            color: [0, 0, 0],
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

    return () => {
      cancelled = true;
    };
  }, [loading, loadFailed, currentPage, zoom, result]);

  // -------------------------------------------------------------------------
  // Toolbar position (fixed positioning, follows the selected span)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!selectedId) {
      setToolbarPos({ x: -9999, y: -9999 });
      return;
    }
    const span = spans.find((s) => s.id === selectedId);
    if (!span || !pageContainerRef.current) return;

    const update = () => {
      const el = pageContainerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const style = getEffectiveStyle(span, activeStyle);
      const spanPx = style.size * zoom;
      const spanX = rect.left + (span.canvasX + style.offsetX * zoom);
      const spanY = rect.top + (span.canvasYBaseline + style.offsetY * zoom) - spanPx;

      const tbW = 520;
      const tbH = 40;
      let left = spanX - 12;
      let top = spanY - tbH - 10;

      left = Math.max(8, Math.min(window.innerWidth - tbW - 8, left));
      if (top < 8) top = rect.top + (span.canvasYBaseline + style.offsetY * zoom) + spanPx + 8;
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

  // -------------------------------------------------------------------------
  // Editing — begin
  // -------------------------------------------------------------------------
  const beginEdit = (span) => {
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
        color: existing.overrideColor ?? null,
        offsetX: existing.offsetX ?? 0,
        offsetY: existing.offsetY ?? 0,
      });
    } else {
      setDraftText(span.text);
      setActiveStyle({
        fontFamily: null,
        fontSize: null,
        bold: null,
        italic: null,
        underline: false,
        color: null,
        offsetX: 0,
        offsetY: 0,
      });
    }
  };

  // -------------------------------------------------------------------------
  // Commit — merge text + activeStyle into edits
  // -------------------------------------------------------------------------
  const commitEdit = (text) => {
    const safeText = typeof text === 'string' ? text : null;

    if (!selectedId) return;
    const span = spans.find((s) => s.id === selectedId);
    if (!span) {
      setSelectedId(null);
      return;
    }
    const existing = edits[selectedId];
    const newText =
      safeText !== null ? safeText : typeof draftText === 'string' ? draftText : '';

    // Effective style for offset baking
    const effective = getEffectiveStyle(span, activeStyle);

    // Bounding box (PDF user space, top-down) with move offset applied
    const offsetXpdf = effective.offsetX;
    const offsetYpdf = effective.offsetY;
    const baseBbox = [
      span.pdfX,
      span.pdfYBaselineTopDown - span.pdfFontSize * 0.9,
      span.pdfX + Math.max(span.pdfWidth, span.pdfFontSize * 0.5),
      span.pdfYBaselineTopDown + span.pdfFontSize * 0.15,
    ];
    const bbox = [
      baseBbox[0] + offsetXpdf,
      baseBbox[1] + offsetYpdf,
      baseBbox[2] + offsetXpdf,
      baseBbox[3] + offsetYpdf,
    ];

    // Effective font size and color (with overrides applied)
    const finalFontSize = activeStyle.fontSize ?? span.pdfFontSize;
    const finalColor = activeStyle.color ?? span.color;
    const finalFontName = composeBackendFontName(span, activeStyle);

    // Nothing changed? drop the edit
    const nothingChanged =
      newText === span.text &&
      !activeStyle.fontFamily &&
      activeStyle.fontSize === null &&
      activeStyle.bold === null &&
      activeStyle.italic === null &&
      !activeStyle.underline &&
      !activeStyle.color &&
      offsetXpdf === 0 &&
      offsetYpdf === 0;

    if (nothingChanged) {
      if (existing) {
        setEdits((prev) => {
          const next = { ...prev };
          delete next[selectedId];
          return next;
        });
      }
      setSelectedId(null);
      return;
    }

    setEdits((prev) => ({
      ...prev,
      [span.id]: {
        page: span.page,
        bbox,
        originalText: span.text,
        newText: String(newText),
        fontName: finalFontName,
        fontSize: finalFontSize,
        color: finalColor,
        align: 'left',
        // Persist overrides so re-editing keeps them:
        overrideFontFamily: activeStyle.fontFamily,
        overrideFontSize: activeStyle.fontSize,
        overrideBold: activeStyle.bold,
        overrideItalic: activeStyle.italic,
        overrideUnderline: activeStyle.underline,
        overrideColor: activeStyle.color,
        offsetX: offsetXpdf,
        offsetY: offsetYpdf,
      },
    }));
    setSelectedId(null);
  };

  // -------------------------------------------------------------------------
  // Cancel — discard activeStyle + text
  // -------------------------------------------------------------------------
  const cancelEdit = () => {
    setSelectedId(null);
    setActiveStyle({
      fontFamily: null,
      fontSize: null,
      bold: null,
      italic: null,
      underline: false,
      color: null,
      offsetX: 0,
      offsetY: 0,
    });
  };

  // -------------------------------------------------------------------------
  // Delete — mark span as empty text
  // -------------------------------------------------------------------------
  const handleDeleteText = () => {
    if (!selectedId) return;
    const span = spans.find((s) => s.id === selectedId);
    if (!span) return;

    const effective = getEffectiveStyle(span, activeStyle);
    const baseBbox = [
      span.pdfX,
      span.pdfYBaselineTopDown - span.pdfFontSize * 0.9,
      span.pdfX + Math.max(span.pdfWidth, span.pdfFontSize * 0.5),
      span.pdfYBaselineTopDown + span.pdfFontSize * 0.15,
    ];
    const bbox = [
      baseBbox[0] + effective.offsetX,
      baseBbox[1] + effective.offsetY,
      baseBbox[2] + effective.offsetX,
      baseBbox[3] + effective.offsetY,
    ];

    setEdits((prev) => ({
      ...prev,
      [span.id]: {
        page: span.page,
        bbox,
        originalText: span.text,
        newText: '',
        fontName: span.fontRaw,
        fontSize: span.pdfFontSize,
        color: span.color,
        align: 'left',
        overrideFontFamily: null,
        overrideFontSize: null,
        overrideBold: null,
        overrideItalic: null,
        overrideUnderline: false,
        overrideColor: null,
        offsetX: effective.offsetX,
        offsetY: effective.offsetY,
      },
    }));
    setSelectedId(null);
  };

  // -------------------------------------------------------------------------
  // Drag-to-move handler
  // -------------------------------------------------------------------------
  const handleMoveStart = (e) => {
    e.preventDefault();
    e.stopPropagation();

    moveDragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      initX: activeStyle.offsetX || 0,
      initY: activeStyle.offsetY || 0,
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

  const handleMoveEnd = () => {
    /* handled inside handleMoveStart's onUp */
  };

  // -------------------------------------------------------------------------
  // Other edit mutations
  // -------------------------------------------------------------------------
  const revertEdit = (spanId) => {
    setEdits((prev) => {
      const next = { ...prev };
      delete next[spanId];
      return next;
    });
    if (selectedId === spanId) setSelectedId(null);
  };

  const clearEditsOnPage = () => {
    setEdits((prev) => {
      const next = {};
      for (const k in prev) if (prev[k].page !== currentPage) next[k] = prev[k];
      return next;
    });
  };

  const handleZoomIn = () => {
    setUserZoomed(true);
    setZoom((z) => Math.min(3.0, +(z + 0.2).toFixed(2)));
  };
  const handleZoomOut = () => {
    setUserZoomed(true);
    setZoom((z) => Math.max(0.2, +(z - 0.2).toFixed(2)));
  };
  const handleFitToScreen = () => setUserZoomed(false);

  // -------------------------------------------------------------------------
  // Save
  // -------------------------------------------------------------------------
  const handleSave = async () => {
    if (Object.keys(edits).length === 0) {
      setErrorMsg('Make at least one text change before saving.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      const payload = Object.values(edits).map((e) => ({
        page: e.page,
        bbox: e.bbox,
        originalText: e.originalText,
        newText: e.newText,
        fontName: e.fontName,
        fontSize: e.fontSize,
        color: e.color,
        align: e.align,
        underline: Boolean(e.overrideUnderline),
      }));
      const output = await editPdfText(file, payload);
      const url = URL.createObjectURL(output.blob);
      setResult({
        url,
        filename: output.filename,
        originalSize: output.originalSize,
        compressedSize: output.compressedSize,
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

  const totalEdits = Object.keys(edits).length;
  const pageHasSpans = spans.length > 0;

  // =========================================================================
  // Success screen
  // =========================================================================
  if (result) {
    return (
      <div className="bg-slate-50 min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
            <button
              onClick={handleBack}
              className="flex items-center space-x-1.5 text-slate-600 hover:text-slate-900 font-semibold text-sm px-3 py-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
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
            <p className="text-xs text-slate-500 truncate">
              Generated file: <strong className="text-slate-800">{result.filename}</strong>
            </p>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs flex items-center justify-between">
              <span className="text-slate-500 font-semibold">{formatFileSize(result.originalSize)}</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <span className="text-emerald-700 font-bold">{formatFileSize(result.compressedSize)}</span>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Your edits are still in the editor. Click <strong>Continue Editing</strong> to make
              more changes, or download the file below.
            </p>

            <div className="flex flex-col gap-3 pt-1">
              <a
                href={result.url}
                download={result.filename}
                className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-md shadow-rose-600/20 flex items-center justify-center space-x-2 transition"
              >
                <Download className="w-4 h-4" />
                <span>Download Edited PDF</span>
              </a>

              <button
                onClick={handleContinueEditing}
                className="w-full py-3 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-sm font-bold transition cursor-pointer flex items-center justify-center space-x-2"
              >
                <Edit3 className="w-4 h-4" />
                <span>Continue Editing</span>
              </button>

              <button
                onClick={handleBack}
                className="w-full py-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition cursor-pointer"
              >
                Return to Home
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // Editor UI
  // =========================================================================
  return (
    <div className="bg-slate-50 min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <button
            onClick={handleBack}
            className="flex items-center space-x-1.5 text-slate-600 hover:text-slate-900 font-semibold text-xs sm:text-sm px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
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
            <button
              onClick={handleSave}
              disabled={saving || totalEdits === 0}
              className="px-3 sm:px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm flex items-center space-x-1.5 transition cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Save &amp; Download</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 flex flex-col space-y-3">
        {errorMsg && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="flex-1 font-medium">{errorMsg}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* -------- Viewer -------- */}
          <div
            ref={viewerOuterRef}
            className="lg:col-span-9 bg-slate-200/60 rounded-3xl border border-slate-200 p-2 sm:p-4 flex flex-col items-center justify-center relative overflow-hidden h-[calc(100vh-160px)] min-h-[420px]"
          >
            {loading || rendering ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-3 text-slate-500">
                <Loader2 className="w-9 h-9 animate-spin text-rose-500" />
                <p className="text-xs font-semibold">
                  {loading ? 'Loading document…' : 'Rendering page…'}
                </p>
              </div>
            ) : loadFailed ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-3 text-slate-500">
                <FileImage className="w-10 h-10 text-slate-400" />
                <p className="text-xs font-semibold">Unable to display this PDF.</p>
              </div>
            ) : pageDataUrl ? (
              <div className="relative bg-white shadow-xl rounded-md overflow-auto max-w-full max-h-full">
                <div
                  ref={pageContainerRef}
                  style={{
                    position: 'relative',
                    width: `${pageDims.width}px`,
                    height: `${pageDims.height}px`,
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={pageDataUrl}
                    alt={`Page ${currentPage}`}
                    draggable={false}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: `${pageDims.width}px`,
                      height: `${pageDims.height}px`,
                      maxWidth: 'none',
                      maxHeight: 'none',
                      display: 'block',
                      userSelect: 'none',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Overlay of editable spans */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: `${pageDims.width}px`,
                      height: `${pageDims.height}px`,
                    }}
                  >
                    {spans.map((span) => {
                      const edit = edits[span.id];
                      const isSelected = selectedId === span.id;
                      const isModified = Boolean(edit);

                      // Effective style for rendering
                      const displayStyle = isSelected
                        ? activeStyle
                        : edit
                        ? {
                            fontFamily: edit.overrideFontFamily,
                            fontSize: edit.overrideFontSize,
                            bold: edit.overrideBold,
                            italic: edit.overrideItalic,
                            underline: edit.overrideUnderline,
                            color: edit.overrideColor,
                            offsetX: edit.offsetX,
                            offsetY: edit.offsetY,
                          }
                        : null;

                      const eff = getEffectiveStyle(span, displayStyle);
                      const cssFont = cssStackFor(span, displayStyle);
                      const offsetPx = { x: eff.offsetX * zoom, y: eff.offsetY * zoom };

                      const fontPx = eff.size * zoom;
                      const left = span.canvasX + offsetPx.x;
                      const baselinePx = span.canvasYBaseline + offsetPx.y;

                      const lineHeightPx = fontPx * 1.15;
                      const baselineFromTop = getBaselineFromTop(cssFont, fontPx, lineHeightPx);
                      const top = baselinePx - baselineFromTop;
                      const minWidth = Math.max(span.widthPx, 12);

                      const displayText = isModified ? edit.newText : span.text;

                      const sharedStyle = {
                        left: `${left}px`,
                        top: `${top}px`,
                        height: `${lineHeightPx}px`,
                        lineHeight: `${lineHeightPx}px`,
                        fontSize: `${fontPx}px`,
                        fontFamily: cssFont,
                        fontWeight: eff.bold ? 'bold' : 'normal',
                        fontStyle: eff.italic ? 'italic' : 'normal',
                        textDecoration: eff.underline ? 'underline' : 'none',
                        whiteSpace: 'pre',
                        padding: 0,
                        margin: 0,
                        boxSizing: 'border-box',
                      };

                      // ---------- EDITING ----------
                      if (isSelected) {
                        return (
                          <div
                            key={span.id}
                            className="absolute z-30"
                            style={{
                              ...sharedStyle,
                              width: `${minWidth + 30}px`,
                              outline: isMoving
                                ? '1.5px dashed #3b82f6'
                                : '1.5px solid #3b82f6',
                              outlineOffset: '0px',
                            }}
                          >
                            <div
                              className="absolute rounded-[2px] bg-white"
                              style={{ inset: 0 }}
                            />
                            <TextEditBox
                              initialText={draftText}
                              onInput={(v) => setDraftText(typeof v === 'string' ? v : '')}
                              onCommit={commitEdit}
                              onCancel={cancelEdit}
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                width: '100%',
                                height: '100%',
                                padding: 0,
                                margin: 0,
                                border: 'none',
                                outline: 'none',
                                backgroundColor: 'transparent',
                                fontFamily: cssFont,
                                fontSize: `${fontPx}px`,
                                fontWeight: eff.bold ? 'bold' : 'normal',
                                fontStyle: eff.italic ? 'italic' : 'normal',
                                textDecoration: eff.underline ? 'underline' : 'none',
                                color: rgbToCss(eff.color),
                                lineHeight: `${lineHeightPx}px`,
                                boxSizing: 'border-box',
                                textAlign: 'left',
                                whiteSpace: 'pre',
                                overflow: 'hidden',
                                cursor: isMoving ? 'move' : 'text',
                              }}
                            />
                          </div>
                        );
                      }

                      // ---------- MODIFIED ----------
                      if (isModified) {
                        if (edit.newText === '') {
                          // deleted — show subtle indicator on hover
                          return (
                            <div
                              key={span.id}
                              className="absolute z-20 cursor-text group"
                              style={{ ...sharedStyle, width: `${minWidth}px` }}
                              onClick={() => beginEdit(span)}
                              title="Deleted — click to edit"
                            >
                              <div className="absolute rounded-[2px] bg-white" style={{ inset: 0 }} />
                              <span className="hidden group-hover:flex absolute inset-0 items-center justify-center text-[10px] font-bold text-rose-500 bg-rose-50/80 rounded-[2px]">
                                deleted
                              </span>
                            </div>
                          );
                        }
                        return (
                          <div
                            key={span.id}
                            className="absolute z-20 cursor-text group"
                            style={{
                              ...sharedStyle,
                              minWidth: `${minWidth + 10}px`,
                              width: 'auto',
                            }}
                            onClick={() => beginEdit(span)}
                            title="Click to edit"
                          >
                            <div
                              className="absolute rounded-[2px] bg-white"
                              style={{ inset: 0 }}
                            />
                            <span className="relative block">
                              {String(displayText ?? '') || '\u00A0'}
                            </span>
                            <span className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center w-4 h-4 bg-blue-600 text-white rounded-full text-[10px] font-bold">
                              ✎
                            </span>
                          </div>
                        );
                      }

                      // ---------- UNMODIFIED ----------
                      return (
                        <div
                          key={span.id}
                          className="absolute z-10 cursor-text hover:bg-blue-500/15 rounded-[2px] transition-colors"
                          style={{ ...sharedStyle, width: `${minWidth}px` }}
                          onClick={() => beginEdit(span)}
                          title="Click to edit"
                        />
                      );
                    })}
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
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 hover:bg-slate-700 rounded-lg disabled:opacity-30 cursor-pointer"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1 hover:bg-slate-700 rounded-lg disabled:opacity-30 cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <div className="h-4 w-px bg-slate-600" />
                <span className="font-bold px-1.5 py-0.5 bg-slate-700 rounded">{currentPage}</span>
                <span className="text-slate-400">/ {totalPages}</span>
                <div className="h-4 w-px bg-slate-600" />
                <button
                  onClick={handleZoomOut}
                  className="p-1 hover:bg-slate-700 rounded-lg cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleZoomIn}
                  className="p-1 hover:bg-slate-700 rounded-lg cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-slate-300 font-semibold">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={handleFitToScreen}
                  className="p-1 hover:bg-slate-700 rounded-lg cursor-pointer text-slate-300"
                  title="Fit to screen"
                >
                  <Maximize className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* -------- Sidebar -------- */}
          <div className="lg:col-span-3 space-y-3">
            <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-sm text-xs space-y-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <MousePointerClick className="w-4 h-4 text-rose-500" />
                  <span>How to Edit</span>
                </h3>
                <ul className="mt-3 space-y-1.5 text-slate-600 leading-relaxed">
                  <li>1. Click any text — a toolbar appears above it.</li>
                  <li>2. Change font, size, color, weight, or drag to move.</li>
                  <li>3. Press <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px]">Enter</kbd> to save the edit, <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px]">Esc</kbd> to cancel.</li>
                  <li>4. Click <strong>Save &amp; Download</strong> when done.</li>
                </ul>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                  <Type className="w-3.5 h-3.5 text-slate-500" />
                  <span>Preserved Properties</span>
                </h4>
                <p className="mt-2 text-slate-500 leading-relaxed">
                  Font family, weight, italic, underline, size, color, and position are all carried
                  through to the final PDF.
                </p>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Pending changes</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded-full ${
                      totalEdits > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {totalEdits}
                  </span>
                </div>
              </div>

              {!loading && !rendering && pageDataUrl && !pageHasSpans && (
                <div className="border-t border-slate-100 pt-3 text-amber-800 bg-amber-50 -mx-4 -mb-4 px-4 py-3 rounded-b-3xl flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    This page has no extractable text (it may be an image/scan). Use{' '}
                    <strong>OCR PDF</strong> first, then come back to Edit PDF.
                  </p>
                </div>
              )}
            </div>

            {totalEdits > 0 && (
              <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-900 text-sm">Edits on this page</h3>
                  <button
                    onClick={clearEditsOnPage}
                    className="text-[10px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
                  >
                    Clear page
                  </button>
                </div>
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {Object.entries(edits)
                    .filter(([, e]) => e.page === currentPage)
                    .map(([id, e]) => (
                      <div
                        key={id}
                        className="p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-2 text-[11px]"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-400 truncate">
                            Was: {String(e.originalText ?? '')}
                          </p>
                          <p className="text-slate-800 font-semibold truncate">
                            Now:{' '}
                            {typeof e.newText === 'string' && e.newText
                              ? e.newText
                              : '∅ (deleted)'}
                          </p>
                        </div>
                        <button
                          onClick={() => revertEdit(id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer shrink-0"
                          title="Revert"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="bg-sky-50 border border-sky-200 rounded-3xl p-4 text-[11px] text-sky-900 flex items-start space-x-2">
              <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                On save, PyMuPDF redacts the original glyphs and re-inserts new text using the
                closest embedded Base-14 font, matching position, size, and color.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Floating formatting toolbar */}
      {selectedId && !result && (
        <TextFormatToolbar
          activeStyle={activeStyle}
          onChange={setActiveStyle}
          onDelete={handleDeleteText}
          onMoveStart={handleMoveStart}
          onMoveEnd={handleMoveEnd}
          position={toolbarPos}
        />
      )}
    </div>
  );
}