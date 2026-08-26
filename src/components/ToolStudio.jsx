import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ArrowRight,
  Download,
  ArrowUp,
  ArrowDown,
  Trash2,
  FileText,
  Loader2,
  Check,
  RotateCw,
  GripVertical,
  Sliders,
  TrendingDown,
  RotateCcw,
  Image as ImageIcon,
  Code,
  Info,
  SlidersHorizontal,
  Plus
} from 'lucide-react';
import {
  mergePDFs,
  splitPDF,
  rotatePDF,
  imagesToPDF,
  pdfToJpg,
  pdfToMarkdown,
  renderPdfThumbnails,
  removePagesFromPDF,
  extractPagesFromPDF,
  reorganizePDF,
  compressPDF,
  convertWordToPDF,
  convertPowerpointToPDF,
  convertHtmlToPDF,
  convertExcelToPDF,
  convertPdfToWord,
  convertPdfToPowerpoint,
  convertPdfToExcel,
  addPageNumbersToPDF,
  checkPdfPassword
} from '../utils/pdfWorker';

export default function ToolStudio({ tool, initialFiles, initialImageCards, initialHtmlCode, initialHtmlMode, onBack }) {
  const [files, setFiles] = useState(initialFiles || []);
  const [imageCards, setImageCards] = useState(initialImageCards || []);
  const [htmlInputMode, setHtmlInputMode] = useState(initialHtmlMode || 'file');
  const [rawHtmlCode, setRawHtmlCode] = useState(initialHtmlCode || '');

  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Compression tool settings
  const [compressionPercent, setCompressionPercent] = useState(45);

  // Page-selector & Visual tools
  const isPageLevelTool =
    tool.id === 'remove' ||
    tool.id === 'extract' ||
    tool.id === 'organize' ||
    tool.id === 'rotate' ||
    tool.id === 'page-numbers';

  const [thumbnails, setThumbnails] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [isRenderingPages, setIsRenderingPages] = useState(false);
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [rangeInput, setRangeInput] = useState('');
  const [draggedPageIndex, setDraggedPageIndex] = useState(null);
  const [draggedImageIndex, setDraggedImageIndex] = useState(null);

  // Add Page Numbers Options State
  const [pageNumberOptions, setPageNumberOptions] = useState({
    pageMode: 'single',
    position: 'top-right',
    margin: 'recommended',
    firstNumber: 1,
    fromPage: 1,
    toPage: 1,
    textPreset: 'number-only',
    customText: 'Page {n} of {p}',
    fontFamily: 'Helvetica',
    fontSize: 10,
    isBold: false,
    isItalic: false,
    isUnderline: false,
    color: '#334155'
  });

  useEffect(() => {
    if (isPageLevelTool && files.length > 0) {
      loadDocumentThumbnails(files[0]);
    }
  }, [files, tool.id]);

  const loadDocumentThumbnails = async (file) => {
    setErrorMsg('');
    setIsRenderingPages(true);
    setThumbnails([]);
    setSelectedPages(new Set());
    setRangeInput('');

    try {
      const data = await renderPdfThumbnails(file);
      setThumbnails(data.thumbnails);
      setTotalPages(data.totalPages);
      setPageNumberOptions((prev) => ({
        ...prev,
        fromPage: 1,
        toPage: data.totalPages
      }));
    } catch (err) {
      setErrorMsg('Failed to read PDF pages. The file might be corrupted.');
    } finally {
      setIsRenderingPages(false);
    }
  };

  const handleAddMorePdfs = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setErrorMsg('');
    const newFiles = Array.from(e.target.files);

    for (const f of newFiles) {
      const isLocked = await checkPdfPassword(f);
      if (isLocked) {
        setErrorMsg(`"${f.name}" is password-protected and was not added.`);
        return;
      }
    }

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleAddMoreImages = (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const addedList = Array.from(e.target.files).map((file) => ({
      id: `img-${Date.now()}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      rotation: 0
    }));
    setImageCards((prev) => [...prev, ...addedList]);
    setFiles((prev) => [...prev, ...Array.from(e.target.files)]);
  };

  const handleImageDragStart = (e, index) => {
    setDraggedImageIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleImageDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleImageDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedImageIndex === null || draggedImageIndex === dropIndex) return;

    const reordered = [...imageCards];
    const [draggedItem] = reordered.splice(draggedImageIndex, 1);
    reordered.splice(dropIndex, 0, draggedItem);

    setImageCards(reordered);
    setDraggedImageIndex(null);
  };

  const rotateImageCard = (index) => {
    const updated = [...imageCards];
    updated[index].rotation = (updated[index].rotation + 90) % 360;
    setImageCards(updated);
  };

  const deleteImageCard = (index) => {
    const updated = imageCards.filter((_, idx) => idx !== index);
    setImageCards(updated);
    setFiles(updated.map((c) => c.file));
    if (updated.length === 0) onBack();
  };

  const handlePageDragStart = (e, index) => {
    setDraggedPageIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handlePageDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handlePageDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedPageIndex === null || draggedPageIndex === dropIndex) return;

    const reordered = [...thumbnails];
    const [draggedItem] = reordered.splice(draggedPageIndex, 1);
    reordered.splice(dropIndex, 0, draggedItem);

    setThumbnails(reordered);
    setDraggedPageIndex(null);
  };

  const rotateSinglePage = (index, delta = 90) => {
    const updated = [...thumbnails];
    updated[index].rotation = (updated[index].rotation + delta + 360) % 360;
    setThumbnails(updated);
  };

  const rotateAllPages = (delta = 90) => {
    const updated = thumbnails.map((thumb) => ({
      ...thumb,
      rotation: (thumb.rotation + delta + 360) % 360
    }));
    setThumbnails(updated);
  };

  const deleteSinglePage = (index) => {
    if (thumbnails.length <= 1) {
      setErrorMsg('A PDF must contain at least one page.');
      return;
    }
    setThumbnails(thumbnails.filter((_, idx) => idx !== index));
  };

  const setToStringRange = (numSet) => {
    const sorted = Array.from(numSet).sort((a, b) => a - b);
    if (sorted.length === 0) return '';
    const ranges = [];
    let start = sorted[0];
    let end = start;

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = sorted[i];
        end = start;
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    return ranges.join(', ');
  };

  const togglePageSelection = (pageNum) => {
    const updated = new Set(selectedPages);
    if (updated.has(pageNum)) {
      updated.delete(pageNum);
    } else {
      updated.add(pageNum);
    }
    setSelectedPages(updated);
    setRangeInput(setToStringRange(updated));
  };

  const handleRangeInputChange = (e) => {
    const val = e.target.value;
    setRangeInput(val);
    const parts = val.split(',').map((p) => p.trim()).filter(Boolean);
    const newSet = new Set();

    parts.forEach((part) => {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map((n) => parseInt(n.trim(), 10));
        if (!isNaN(start) && !isNaN(end)) {
          const low = Math.max(1, Math.min(start, end));
          const high = Math.min(totalPages, Math.max(start, end));
          for (let i = low; i <= high; i++) newSet.add(i);
        }
      } else {
        const pNum = parseInt(part, 10);
        if (!isNaN(pNum) && pNum >= 1 && pNum <= totalPages) {
          newSet.add(pNum);
        }
      }
    });

    setSelectedPages(newSet);
  };

  const moveFileItem = (index, direction) => {
    const updated = [...files];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= updated.length) return;
    const [movedItem] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, movedItem);
    setFiles(updated);
  };

  const removeFileItem = (index) => {
    const updated = files.filter((_, idx) => idx !== index);
    setFiles(updated);
    if (updated.length === 0) onBack();
  };

  const handleReconfigureSameFile = () => {
    if (result?.url) {
      URL.revokeObjectURL(result.url);
    }
    setResult(null);
    setErrorMsg('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const executeAction = async () => {
    setErrorMsg('');

    if (tool.id === 'merge' && files.length < 2) {
      setErrorMsg('Merge PDF requires at least 2 PDF files. Please click "+ Add More Files" to proceed.');
      return;
    }

    setIsProcessing(true);

    try {
      let output;
      switch (tool.id) {
        case 'page-numbers':
          output = await addPageNumbersToPDF(files[0], pageNumberOptions);
          break;
        case 'pdf-to-excel':
          output = await convertPdfToExcel(files[0]);
          break;
        case 'pdf-to-powerpoint':
          output = await convertPdfToPowerpoint(files[0]);
          break;
        case 'rotate':
          output = await rotatePDF(files[0], thumbnails);
          break;
        case 'pdf-to-word':
          output = await convertPdfToWord(files[0]);
          break;
        case 'excel-to-pdf':
          output = await convertExcelToPDF(files[0]);
          break;
        case 'html-to-pdf':
          output = await convertHtmlToPDF(htmlInputMode === 'code' ? rawHtmlCode : files[0]);
          break;
        case 'powerpoint-to-pdf':
          output = await convertPowerpointToPDF(files[0]);
          break;
        case 'word-to-pdf':
          output = await convertWordToPDF(files[0]);
          break;
        case 'jpg-to-pdf':
          output = await imagesToPDF(imageCards);
          break;
        case 'compress':
          output = await compressPDF(files[0], compressionPercent);
          break;
        case 'organize':
          output = await reorganizePDF(files[0], thumbnails);
          break;
        case 'merge':
          output = await mergePDFs(files);
          break;
        case 'remove':
          output = await removePagesFromPDF(files[0], selectedPages);
          break;
        case 'extract':
          output = await extractPagesFromPDF(files[0], selectedPages);
          break;
        case 'split':
          output = await splitPDF(files[0]);
          break;
        case 'pdf-to-jpg':
          output = await pdfToJpg(files[0]);
          break;
        case 'to-markdown':
          output = await pdfToMarkdown(files[0]);
          break;
        default:
          output = { blob: files[0], filename: `processed_${files[0].name}` };
      }

      const url = URL.createObjectURL(output.blob);
      setResult({
        url,
        filename: output.filename,
        originalSize: output.originalSize,
        compressedSize: output.compressedSize
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setErrorMsg(err.message || 'An error occurred during processing.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    const k = 1024;
    if (bytes < k * k) return `${(bytes / k).toFixed(1)} KB`;
    return `${(bytes / (k * k)).toFixed(2)} MB`;
  };

  const getPositionDotClasses = (pos, isFacing, pageIdx) => {
    let active = pos;
    if (isFacing && (pageIdx + 1) % 2 === 0) {
      if (pos.includes('right')) active = pos.replace('right', 'left');
      else if (pos.includes('left')) active = pos.replace('left', 'right');
    }
    const map = {
      'top-left': 'top-2.5 left-2.5',
      'top-center': 'top-2.5 left-1/2 -translate-x-1/2',
      'top-right': 'top-2.5 right-2.5',
      'middle-left': 'top-1/2 left-2.5 -translate-y-1/2',
      'middle-center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
      'middle-right': 'top-1/2 right-2.5 -translate-y-1/2',
      'bottom-left': 'bottom-2.5 left-2.5',
      'bottom-center': 'bottom-2.5 left-1/2 -translate-x-1/2',
      'bottom-right': 'bottom-2.5 right-2.5'
    };
    return map[active] || 'bottom-2.5 right-2.5';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* Top Studio Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 font-semibold text-sm px-3 py-1.5 rounded-xl hover:bg-slate-100 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>

          <div className="flex items-center space-x-3">
            <div className={`w-8 h-8 rounded-lg ${tool.bg} ${tool.color} flex items-center justify-center`}>
              <tool.icon className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">{tool.name} Workspace</h2>
          </div>

          <div className="w-24" />
        </div>
      </header>

      {/* Main Studio Body */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {errorMsg && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start space-x-2.5">
            <Info className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p className="flex-1 font-medium">{errorMsg}</p>
          </div>
        )}

        {!result ? (
          <div className="space-y-6">
            {/* Context Banners */}
            {tool.id === 'compress' && (
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start space-x-2.5 text-xs text-emerald-900">
                <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p>We try our best to compress your PDF while preserving high visual quality and text clarity.</p>
              </div>
            )}

            {tool.id === 'word-to-pdf' && (
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-start space-x-2.5 text-xs text-blue-900">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p>We try our best to convert your Word document to PDF maintaining an exact visual match and layout.</p>
              </div>
            )}

            {['pdf-to-word', 'pdf-to-powerpoint', 'pdf-to-excel'].includes(tool.id) && (
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-start space-x-2.5 text-xs text-amber-900">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p><strong>Experimental Feature:</strong> This converter is under active development and testing. Complex vector layouts and tables may differ slightly from the source PDF.</p>
              </div>
            )}

            {/* 1. Page Numbers Studio */}
            {tool.id === 'page-numbers' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 text-xs font-semibold">
                    <span className="text-slate-600">{files[0]?.name} ({totalPages} Pages)</span>
                    <span className="text-slate-400">Preview with Active Placement Marker</span>
                  </div>

                  {isRenderingPages ? (
                    <div className="py-32 text-center text-slate-400 space-y-2">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-500" />
                      <p className="text-sm">Rendering document preview...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 max-h-[560px] overflow-y-auto pr-1">
                      {thumbnails.map((thumb, idx) => {
                        const inRange =
                          thumb.pageNumber >= pageNumberOptions.fromPage &&
                          thumb.pageNumber <= pageNumberOptions.toPage;
                        return (
                          <div
                            key={thumb.id}
                            className="relative rounded-2xl border-2 border-slate-200 bg-slate-50 shadow-xs overflow-hidden p-3 flex flex-col items-center justify-center min-h-[200px]"
                          >
                            <img src={thumb.dataUrl} alt={`Page ${idx + 1}`} className="max-h-44 object-contain shadow-sm bg-white" />
                            {inRange && (
                              <div
                                className={`absolute w-4 h-4 bg-rose-500 rounded-full shadow-md border-2 border-white transition-all duration-150 ${getPositionDotClasses(
                                  pageNumberOptions.position,
                                  pageNumberOptions.pageMode === 'facing',
                                  idx
                                )}`}
                              />
                            )}
                            <span className="absolute bottom-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800/80 text-white">
                              {idx + 1}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-sm text-xs">
                  <h3 className="font-bold text-slate-900 text-sm border-b pb-3">Page Number options</h3>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-2">Page mode</label>
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="pageMode"
                          checked={pageNumberOptions.pageMode === 'single'}
                          onChange={() => setPageNumberOptions({ ...pageNumberOptions, pageMode: 'single' })}
                          className="accent-rose-500"
                        />
                        <span className="text-slate-700 font-medium">Single page</span>
                      </label>
                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="pageMode"
                          checked={pageNumberOptions.pageMode === 'facing'}
                          onChange={() => setPageNumberOptions({ ...pageNumberOptions, pageMode: 'facing' })}
                          className="accent-rose-500"
                        />
                        <span className="text-slate-700 font-medium">Facing pages</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 items-center">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1.5">Position:</label>
                      <div className="grid grid-cols-3 gap-1 w-24 h-24 border border-slate-300 rounded-xl p-1 bg-slate-50">
                        {[
                          'top-left', 'top-center', 'top-right',
                          'middle-left', 'middle-center', 'middle-right',
                          'bottom-left', 'bottom-center', 'bottom-right'
                        ].map((pos) => (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => setPageNumberOptions({ ...pageNumberOptions, position: pos })}
                            className={`rounded-md transition-colors flex items-center justify-center ${
                              pageNumberOptions.position === pos
                                ? 'bg-rose-500 text-white shadow-xs'
                                : 'bg-white hover:bg-slate-200 border border-slate-200'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${pageNumberOptions.position === pos ? 'bg-white' : 'bg-slate-400'}`} />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1.5">Margin:</label>
                      <select
                        value={pageNumberOptions.margin}
                        onChange={(e) => setPageNumberOptions({ ...pageNumberOptions, margin: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value="small">Small</option>
                        <option value="recommended">Recommended</option>
                        <option value="large">Large</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">First number:</span>
                      <input
                        type="number"
                        min="1"
                        value={pageNumberOptions.firstNumber}
                        onChange={(e) => setPageNumberOptions({ ...pageNumberOptions, firstNumber: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        className="w-20 px-2 py-1 text-center bg-slate-50 border border-slate-200 rounded-lg font-bold"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Which pages do you want to number?</label>
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500">from</span>
                        <input
                          type="number"
                          min="1"
                          max={totalPages}
                          value={pageNumberOptions.fromPage}
                          onChange={(e) => setPageNumberOptions({ ...pageNumberOptions, fromPage: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                          className="w-14 px-2 py-1 text-center bg-slate-50 border border-slate-200 rounded-lg font-medium"
                        />
                        <span className="text-slate-500">to</span>
                        <input
                          type="number"
                          min="1"
                          max={totalPages}
                          value={pageNumberOptions.toPage}
                          onChange={(e) => setPageNumberOptions({ ...pageNumberOptions, toPage: Math.min(totalPages, parseInt(e.target.value, 10) || totalPages) })}
                          className="w-14 px-2 py-1 text-center bg-slate-50 border border-slate-200 rounded-lg font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="font-semibold text-slate-700 block">Text:</label>
                    <select
                      value={pageNumberOptions.textPreset}
                      onChange={(e) => setPageNumberOptions({ ...pageNumberOptions, textPreset: e.target.value })}
                      className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    >
                      <option value="number-only">Insert only page number (recommended)</option>
                      <option value="page-n">Page &#123;n&#125;</option>
                      <option value="page-n-of-p">Page &#123;n&#125; of &#123;p&#125;</option>
                      <option value="custom">Custom</option>
                    </select>

                    {pageNumberOptions.textPreset === 'custom' && (
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={pageNumberOptions.customText}
                          onChange={(e) => setPageNumberOptions({ ...pageNumberOptions, customText: e.target.value })}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                        />
                        <p className="text-[10px] text-slate-400">Placeholders: &#123;n&#125;, Page &#123;n&#125;, Page &#123;n&#125; of &#123;p&#125;</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="font-semibold text-slate-700 block text-[11px]">Text format:</label>
                    <div className="flex items-center space-x-2">
                      <select
                        value={pageNumberOptions.fontFamily}
                        onChange={(e) => setPageNumberOptions({ ...pageNumberOptions, fontFamily: e.target.value })}
                        className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      >
                        <option value="Helvetica">Arial / Helvetica</option>
                        <option value="Times">Times New Roman</option>
                        <option value="Courier">Courier</option>
                      </select>

                      <div className="flex items-center space-x-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                        <button
                          type="button"
                          onClick={() => setPageNumberOptions({ ...pageNumberOptions, isBold: !pageNumberOptions.isBold })}
                          className={`px-2.5 py-1 font-bold rounded ${pageNumberOptions.isBold ? 'bg-rose-500 text-white' : 'text-slate-600'}`}
                        >
                          B
                        </button>
                        <button
                          type="button"
                          onClick={() => setPageNumberOptions({ ...pageNumberOptions, isItalic: !pageNumberOptions.isItalic })}
                          className={`px-2.5 py-1 italic rounded ${pageNumberOptions.isItalic ? 'bg-rose-500 text-white' : 'text-slate-600'}`}
                        >
                          I
                        </button>
                        <button
                          type="button"
                          onClick={() => setPageNumberOptions({ ...pageNumberOptions, isUnderline: !pageNumberOptions.isUnderline })}
                          className={`px-2.5 py-1 underline rounded ${pageNumberOptions.isUnderline ? 'bg-rose-500 text-white' : 'text-slate-600'}`}
                        >
                          U
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={executeAction}
                    disabled={isProcessing || isRenderingPages}
                    className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Add page numbers</span><ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {/* 2. Rotate PDF Studio */}
            {tool.id === 'rotate' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-purple-50 rounded-2xl border border-purple-100 text-xs">
                  <div className="flex items-center space-x-2 truncate">
                    <FileText className="w-4 h-4 text-purple-600 shrink-0" />
                    <span className="font-semibold text-purple-950 truncate">{files[0]?.name}</span>
                    <span className="text-purple-600 font-medium">({thumbnails.length} pages)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => rotateAllPages(90)}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold transition flex items-center space-x-1 shadow-sm"
                    >
                      <RotateCw className="w-4 h-4" />
                      <span>Rotate All 90°</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => rotateAllPages(-90)}
                      className="px-3 py-2 bg-white hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl font-semibold transition flex items-center space-x-1"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>-90°</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {thumbnails.map((thumb, idx) => (
                    <div key={thumb.id} className="group relative rounded-2xl border-2 bg-slate-50 overflow-hidden border-slate-200 hover:border-purple-400 p-2 shadow-xs transition">
                      <div className="p-2 flex items-center justify-center min-h-[160px]">
                        <img src={thumb.dataUrl} alt={`Page ${idx + 1}`} style={{ transform: `rotate(${thumb.rotation}deg)` }} className="max-h-36 object-contain transition duration-200" />
                      </div>
                      <div className="absolute top-2 right-2">
                        <button onClick={() => rotateSinglePage(idx, 90)} className="p-2 bg-white/95 text-slate-700 rounded-xl shadow hover:text-purple-600 transition">
                          <RotateCw className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="px-2 py-1 bg-white border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                        <span>Page {idx + 1}</span>
                        <span className={thumb.rotation !== 0 ? 'text-purple-600 font-bold' : 'text-slate-400'}>{thumb.rotation}°</span>
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={executeAction} disabled={isProcessing} className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2">
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Save Rotated PDF</span>}
                </button>
              </div>
            )}

            {/* 3. Organize PDF Studio */}
            {tool.id === 'organize' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Drag & drop pages to rearrange. Hover to rotate or delete individual pages.</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {thumbnails.map((thumb, idx) => (
                    <div
                      key={thumb.id}
                      draggable
                      onDragStart={(e) => handlePageDragStart(e, idx)}
                      onDragOver={handlePageDragOver}
                      onDrop={(e) => handlePageDrop(e, idx)}
                      className={`group relative rounded-2xl border-2 bg-slate-50 overflow-hidden cursor-grab active:cursor-grabbing p-2 shadow-xs transition ${
                        draggedPageIndex === idx ? 'opacity-40 border-amber-400' : 'border-slate-200 hover:border-amber-400'
                      }`}
                    >
                      <div className="p-2 flex items-center justify-center min-h-[160px]">
                        <img src={thumb.dataUrl} alt={`Page ${idx + 1}`} style={{ transform: `rotate(${thumb.rotation}deg)` }} className="max-h-36 object-contain transition duration-200" />
                      </div>
                      <div className="absolute top-2 right-2 flex space-x-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition">
                        <button onClick={() => rotateSinglePage(idx, 90)} className="p-1.5 bg-white text-slate-700 rounded-lg shadow hover:text-amber-600"><RotateCw className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteSinglePage(idx)} className="p-1.5 bg-white text-slate-700 rounded-lg shadow hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="px-2 py-1 bg-white border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                        <span>Pos: {idx + 1}</span>
                        {thumb.rotation !== 0 && <span className="text-amber-600 font-bold">{thumb.rotation}°</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={executeAction} disabled={isProcessing} className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2">
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Save Organized PDF</span>}
                </button>
              </div>
            )}

            {/* 4. Remove / Extract Pages Studio */}
            {(tool.id === 'remove' || tool.id === 'extract') && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">Pages to {tool.id === 'remove' ? 'remove' : 'extract'} (Type range or click thumbnails):</label>
                  <input
                    type="text"
                    placeholder="e.g. 1, 3-5, 8"
                    value={rangeInput}
                    onChange={handleRangeInputChange}
                    className="w-full px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                  {thumbnails.map((thumb) => {
                    const isSelected = selectedPages.has(thumb.pageNumber);
                    const isRemove = tool.id === 'remove';
                    return (
                      <div
                        key={thumb.pageNumber}
                        onClick={() => togglePageSelection(thumb.pageNumber)}
                        className={`group relative rounded-2xl border-2 overflow-hidden cursor-pointer transition p-2 bg-slate-50 ${
                          isSelected
                            ? isRemove
                              ? 'border-red-500 ring-2 ring-red-400/20'
                              : 'border-emerald-500 ring-2 ring-emerald-400/20'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <img src={thumb.dataUrl} alt={`Page ${thumb.pageNumber}`} className={`w-full h-auto object-cover ${isSelected ? 'opacity-50' : ''}`} />
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                            <div className={`w-7 h-7 rounded-full text-white flex items-center justify-center shadow ${isRemove ? 'bg-red-500' : 'bg-emerald-600'}`}>
                              {isRemove ? <Trash2 className="w-4 h-4" /> : <Check className="w-4 h-4 stroke-[3]" />}
                            </div>
                          </div>
                        )}
                        <span className="absolute bottom-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900/80 text-white">{thumb.pageNumber}</span>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={executeAction}
                  disabled={isProcessing || selectedPages.size === 0}
                  className={`w-full py-4 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 ${
                    tool.id === 'remove' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>{tool.id === 'remove' ? `Remove ${selectedPages.size} Pages` : `Extract ${selectedPages.size} Pages`}</span>}
                </button>
              </div>
            )}

            {/* 5. Compress PDF Studio */}
            {tool.id === 'compress' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-2xl mx-auto space-y-6 shadow-sm">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                  <div className="flex items-center space-x-2.5 truncate">
                    <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="font-bold text-slate-800 truncate">{files[0]?.name}</span>
                    <span className="text-slate-400 font-medium">({formatFileSize(files[0]?.size)})</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Compression Preset</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { percent: 25, label: 'Low', desc: 'Maximum Quality' },
                      { percent: 45, label: 'Recommended', desc: 'Balanced Quality & Size' },
                      { percent: 75, label: 'High', desc: 'Smallest File Size' }
                    ].map((preset) => (
                      <button
                        key={preset.percent}
                        type="button"
                        onClick={() => setCompressionPercent(preset.percent)}
                        className={`p-4 rounded-2xl border text-left transition ${
                          compressionPercent === preset.percent ? 'border-emerald-500 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex justify-between font-bold text-xs text-slate-800">
                          <span>{preset.label}</span>
                          <span className="text-emerald-600">~{preset.percent}%</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">{preset.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span className="flex items-center gap-1.5"><Sliders className="w-4 h-4 text-slate-500" /> Target Compression Ratio</span>
                    <span className="text-emerald-600 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">{compressionPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={compressionPercent}
                    onChange={(e) => setCompressionPercent(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                </div>

                <button onClick={executeAction} disabled={isProcessing} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2">
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Compress PDF (~{compressionPercent}%)</span>}
                </button>
              </div>
            )}

            {/* 6. JPG to PDF Studio */}
            {tool.id === 'jpg-to-pdf' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-500 font-medium">Drag images to reorder. Output order corresponds to left-to-right, top-to-bottom.</div>
                  <label htmlFor="studioAddImagesInput" className="px-3 py-1.5 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 text-yellow-800 font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add More Images</span>
                    <input
                      type="file"
                      id="studioAddImagesInput"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleAddMoreImages}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {imageCards.map((card, idx) => (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={(e) => handleImageDragStart(e, idx)}
                      onDragOver={handleImageDragOver}
                      onDrop={(e) => handleImageDrop(e, idx)}
                      className={`group relative rounded-2xl border-2 bg-slate-50 overflow-hidden cursor-grab active:cursor-grabbing p-2 shadow-xs transition ${
                        draggedImageIndex === idx ? 'opacity-40 border-yellow-400' : 'border-slate-200 hover:border-yellow-400'
                      }`}
                    >
                      <div className="p-2 flex items-center justify-center min-h-[140px]">
                        <img src={card.previewUrl} alt={card.file.name} style={{ transform: `rotate(${card.rotation}deg)` }} className="max-h-32 object-contain" />
                      </div>
                      <div className="absolute top-2 right-2 flex space-x-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition">
                        <button onClick={() => rotateImageCard(idx)} className="p-1.5 bg-white text-slate-700 rounded-lg shadow hover:text-yellow-600"><RotateCw className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteImageCard(idx)} className="p-1.5 bg-white text-slate-700 rounded-lg shadow hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="px-2 py-1 bg-white border-t border-slate-100 flex items-center justify-between text-[10px] font-semibold text-slate-500">
                        <span>Page {idx + 1}</span>
                        <span>{(card.file.size / 1024).toFixed(0)} KB</span>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={executeAction} disabled={isProcessing} className="w-full py-4 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2">
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Convert {imageCards.length} Images to PDF</span>}
                </button>
              </div>
            )}

            {/* 7. Default File Workspace (Merge PDF & Conversions) */}
            {!['page-numbers', 'rotate', 'organize', 'remove', 'extract', 'compress', 'jpg-to-pdf'].includes(tool.id) && (
              <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-xl mx-auto space-y-6 shadow-sm">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {tool.id === 'merge' ? `PDF Documents to Merge (${files.length})` : 'Target File(s)'}
                    </span>

                    {tool.id === 'merge' && (
                      <label htmlFor="studioAddMorePdfsInput" className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1 transition">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add More Files</span>
                        <input
                          type="file"
                          id="studioAddMorePdfsInput"
                          multiple
                          accept="application/pdf"
                          className="hidden"
                          onChange={handleAddMorePdfs}
                        />
                      </label>
                    )}
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {files.map((file, idx) => (
                      <div key={`${file.name}-${idx}`} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                        <div className="flex items-center space-x-3 truncate pr-2">
                          <span className="font-bold text-slate-400 w-4">{idx + 1}.</span>
                          <FileText className="w-5 h-5 text-slate-500 shrink-0" />
                          <span className="font-semibold text-slate-800 truncate">{file.name}</span>
                          <span className="text-slate-400 font-medium shrink-0">({formatFileSize(file.size)})</span>
                        </div>
                        {tool.id === 'merge' && (
                          <div className="flex items-center space-x-1 shrink-0">
                            <button onClick={() => moveFileItem(idx, -1)} disabled={idx === 0} className="p-1 text-slate-500 hover:bg-slate-200 rounded disabled:opacity-20" title="Move Up"><ArrowUp className="w-3.5 h-3.5" /></button>
                            <button onClick={() => moveFileItem(idx, 1)} disabled={idx === files.length - 1} className="p-1 text-slate-500 hover:bg-slate-200 rounded disabled:opacity-20" title="Move Down"><ArrowDown className="w-3.5 h-3.5" /></button>
                            <button onClick={() => removeFileItem(idx)} className="p-1 text-rose-500 hover:bg-rose-50 rounded" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {tool.id === 'merge' && files.length < 2 && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-2xl font-medium">
                      At least 2 PDF files are required to merge. Please add more files using the button above.
                    </p>
                  )}
                </div>

                <button
                  onClick={executeAction}
                  disabled={isProcessing || (tool.id === 'merge' && files.length < 2)}
                  className={`w-full py-4 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 ${
                    tool.id === 'merge' ? 'bg-rose-600 hover:bg-rose-700 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed' :
                    tool.id === 'pdf-to-word' ? 'bg-blue-600 hover:bg-blue-700' :
                    tool.id === 'pdf-to-powerpoint' || tool.id === 'powerpoint-to-pdf' ? 'bg-orange-600 hover:bg-orange-700' :
                    tool.id === 'pdf-to-excel' || tool.id === 'excel-to-pdf' ? 'bg-emerald-600 hover:bg-emerald-700' :
                    tool.id === 'html-to-pdf' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>{tool.id === 'merge' ? `Merge ${files.length} PDFs` : 'Convert Now'}</span>}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Result & Download Card */
          <div className="bg-white border border-slate-200 rounded-3xl p-10 max-w-lg mx-auto text-center space-y-6 shadow-md">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
            <h3 className="text-xl font-bold text-slate-900">Task Completed Successfully!</h3>

            {tool.id === 'compress' && result.originalSize && result.compressedSize && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-around text-xs">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Original</p>
                  <p className="font-bold text-slate-700">{formatFileSize(result.originalSize)}</p>
                </div>
                <TrendingDown className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Compressed</p>
                  <p className="font-bold text-emerald-700">{formatFileSize(result.compressedSize)}</p>
                </div>
                <span className="bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-xs font-extrabold">
                  -{Math.max(0, Math.round(((result.originalSize - result.compressedSize) / result.originalSize) * 100))}%
                </span>
              </div>
            )}

            <p className="text-xs text-slate-500 truncate px-4">
              Generated file: <strong className="text-slate-800">{result.filename}</strong>
            </p>

            <div className="flex flex-col gap-3 pt-2">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleReconfigureSameFile}
                  className="flex-1 py-3.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
                >
                  <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                  <span>Edit & Reconfigure</span>
                </button>

                <button onClick={onBack} className="flex-1 py-3.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition cursor-pointer">
                  Return to Home
                </button>
              </div>

              <a
                href={result.url}
                download={result.filename}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 text-center flex items-center justify-center space-x-2 transition"
              >
                <Download className="w-4 h-4" />
                <span>Download File</span>
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}