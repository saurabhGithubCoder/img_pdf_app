import React, { useState, useEffect, useRef } from 'react';
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
  Plus,
  Type,
  Presentation,
  Sheet,
  FileCode,
  RefreshCw,
  RectangleVertical,
  RectangleHorizontal,
  Square,
  Maximize2
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
  addWatermarkToPDF,
  checkPdfPassword,
  checkDocxPassword,
  checkPptxPassword,
  checkExcelPassword
} from '../utils/pdfWorker';

export default function ToolStudio({ tool, initialFiles, initialImageCards, initialHtmlCode, initialHtmlMode, onBack }) {
  const [files, setFiles] = useState(initialFiles || []);
  const [imageCards, setImageCards] = useState(initialImageCards || []);
  const [htmlInputMode, setHtmlInputMode] = useState(initialHtmlMode || 'file');
  const [rawHtmlCode, setRawHtmlCode] = useState(initialHtmlCode || '');

  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const changeFileInputRef = useRef(null);

  // Compression tool settings
  const [compressionPercent, setCompressionPercent] = useState(45);

  // Page-selector & Visual tools
  const isPageLevelTool =
    tool.id === 'remove' ||
    tool.id === 'extract' ||
    tool.id === 'organize' ||
    tool.id === 'rotate' ||
    tool.id === 'page-numbers' ||
    tool.id === 'watermark';

  const [thumbnails, setThumbnails] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [isRenderingPages, setIsRenderingPages] = useState(false);
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [rangeInput, setRangeInput] = useState('');
  const [draggedPageIndex, setDraggedPageIndex] = useState(null);
  const [draggedImageIndex, setDraggedImageIndex] = useState(null);

  // Image to PDF Options State
  const [imageToPdfOptions, setImageToPdfOptions] = useState({
    orientation: 'portrait', // 'portrait' | 'landscape'
    pageSize: 'a4', // 'fit' | 'a4' | 'letter'
    margin: 'none', // 'none' | 'small' | 'big'
    mergeAll: true,
  });

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

  // Add Watermark Options State
  const [watermarkOptions, setWatermarkOptions] = useState({
    type: 'text',
    text: 'CONFIDENTIAL',
    imageFile: null,
    imagePreviewUrl: '',
    position: 'middle-center',
    isMosaic: false,
    opacity: 1.0,
    rotation: 0,
    fromPage: 1,
    toPage: 1,
    layer: 'over',
    fontFamily: 'Helvetica',
    fontSize: 32,
    isBold: false,
    isItalic: false,
    isUnderline: false,
    color: '#E11D48'
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
      setWatermarkOptions((prev) => ({
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

  const getFileInputAccept = () => {
    if (tool.id === 'jpg-to-pdf') return 'image/jpeg,image/png,image/webp';
    if (tool.id === 'word-to-pdf') return '.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword';
    if (tool.id === 'powerpoint-to-pdf') return '.pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint';
    if (tool.id === 'excel-to-pdf') return '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
    if (tool.id === 'html-to-pdf') return '.html,.htm,text/html';
    return 'application/pdf';
  };

  const handleReplaceDocument = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');

    let isLocked = false;
    if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
      isLocked = await checkPdfPassword(file);
    } else if (tool.id === 'word-to-pdf') {
      isLocked = await checkDocxPassword(file);
    } else if (tool.id === 'powerpoint-to-pdf') {
      isLocked = await checkPptxPassword(file);
    } else if (tool.id === 'excel-to-pdf') {
      isLocked = await checkExcelPassword(file);
    }

    if (isLocked) {
      setErrorMsg(`Cannot process: "${file.name}" is password-protected or encrypted.`);
      return;
    }

    setFiles([file]);
    if (result?.url) {
      URL.revokeObjectURL(result.url);
      setResult(null);
    }
    e.target.value = '';
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
    e.target.value = '';
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
    e.target.value = '';
  };

  const handleWatermarkImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setWatermarkOptions((prev) => ({
        ...prev,
        imageFile: file,
        imagePreviewUrl: URL.createObjectURL(file)
      }));
    }
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

    if (tool.id === 'watermark' && watermarkOptions.type === 'image' && !watermarkOptions.imageFile) {
      setErrorMsg('Please select an image file to use as the watermark.');
      return;
    }

    setIsProcessing(true);

    try {
      let output;
      switch (tool.id) {
        case 'jpg-to-pdf':
          output = await imagesToPDF(imageCards, imageToPdfOptions);
          break;
        case 'watermark':
          output = await addWatermarkToPDF(files[0], watermarkOptions);
          break;
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

  const getPositionDotClasses = (pos) => {
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
    return map[pos] || 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
  };

  const renderSingleFileThumbnailCard = (file) => {
    let IconComp = FileText;
    let badgeText = 'DOC';
    let badgeColor = 'bg-blue-600 text-white';
    let borderColor = 'border-blue-200';
    let bgGradient = 'from-blue-50/50 to-slate-50';

    if (tool.id === 'powerpoint-to-pdf') {
      IconComp = Presentation;
      badgeText = 'PPT';
      badgeColor = 'bg-orange-600 text-white';
      borderColor = 'border-orange-200';
      bgGradient = 'from-orange-50/50 to-slate-50';
    } else if (tool.id === 'excel-to-pdf') {
      IconComp = Sheet;
      badgeText = 'XLS';
      badgeColor = 'bg-emerald-600 text-white';
      borderColor = 'border-emerald-200';
      bgGradient = 'from-emerald-50/50 to-slate-50';
    } else if (tool.id === 'html-to-pdf') {
      IconComp = FileCode;
      badgeText = 'HTML';
      badgeColor = 'bg-amber-600 text-white';
      borderColor = 'border-amber-200';
      bgGradient = 'from-amber-50/50 to-slate-50';
    }

    return (
      <div className={`relative mx-auto w-56 sm:w-64 rounded-2xl border-2 ${borderColor} bg-gradient-to-b ${bgGradient} p-5 shadow-sm text-center flex flex-col items-center justify-between space-y-4`}>
        <div className="absolute top-3 right-3">
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${badgeColor}`}>
            {badgeText}
          </span>
        </div>

        <div className="w-20 h-28 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col items-center justify-center p-3 relative mt-2">
          <div className="w-full space-y-1.5 opacity-40">
            <div className="h-1.5 bg-slate-400 rounded-full w-3/4" />
            <div className="h-1.5 bg-slate-300 rounded-full w-full" />
            <div className="h-1.5 bg-slate-300 rounded-full w-5/6" />
            <div className="h-1.5 bg-slate-200 rounded-full w-1/2" />
          </div>
          <IconComp className="w-7 h-7 absolute inset-0 m-auto text-slate-700 opacity-90" />
        </div>

        <div className="w-full space-y-1">
          <p className="font-bold text-xs text-slate-800 truncate px-2" title={file.name}>
            {file.name}
          </p>
          <p className="text-[11px] font-medium text-slate-400">
            {formatFileSize(file.size)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => changeFileInputRef.current?.click()}
          className="text-[11px] font-bold text-rose-600 hover:text-rose-700 transition flex items-center space-x-1.5 bg-white hover:bg-rose-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Change Document</span>
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      <input
        type="file"
        ref={changeFileInputRef}
        accept={getFileInputAccept()}
        className="hidden"
        onChange={handleReplaceDocument}
      />

      {/* Top Studio Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 font-semibold text-sm px-3 py-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
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
            {/* 1. Image to PDF Studio */}
            {tool.id === 'jpg-to-pdf' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Previews & Rearrange */}
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 text-xs font-semibold">
                    <span className="text-slate-600">{imageCards.length} {imageCards.length === 1 ? 'Image' : 'Images'} Selected</span>
                    <label htmlFor="studioAddImagesInput" className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1">
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

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[560px] overflow-y-auto pr-1">
                    {imageCards.map((card, idx) => {
                      const isLandscape = imageToPdfOptions.orientation === 'landscape';
                      const marginPadding =
                        imageToPdfOptions.margin === 'small' ? 'p-3' : imageToPdfOptions.margin === 'big' ? 'p-5' : 'p-0';

                      return (
                        <div
                          key={card.id}
                          draggable
                          onDragStart={(e) => handleImageDragStart(e, idx)}
                          onDragOver={handleImageDragOver}
                          onDrop={(e) => handleImageDrop(e, idx)}
                          className={`group relative rounded-2xl border-2 overflow-hidden bg-slate-50 flex flex-col items-center justify-center p-2 shadow-xs cursor-grab active:cursor-grabbing transition ${
                            draggedImageIndex === idx ? 'opacity-40 border-rose-400' : 'border-slate-200 hover:border-rose-300'
                          }`}
                        >
                          {/* Simulated Paper Sheet */}
                          <div
                            className={`w-full bg-white border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden transition-all shadow-xs ${marginPadding} ${
                              isLandscape ? 'aspect-4/3' : 'aspect-3/4'
                            }`}
                          >
                            <img
                              src={card.previewUrl}
                              alt={card.file.name}
                              style={{ transform: `rotate(${card.rotation}deg)` }}
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>

                          <div className="absolute top-3 right-3 flex space-x-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition">
                            <button
                              type="button"
                              onClick={() => rotateImageCard(idx)}
                              className="p-1.5 bg-white text-slate-700 rounded-lg shadow hover:text-rose-600 cursor-pointer"
                              title="Rotate"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteImageCard(idx)}
                              className="p-1.5 bg-white text-slate-700 rounded-lg shadow hover:text-red-600 cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="w-full px-2 pt-2 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                            <span className="truncate max-w-[100px]">{card.file.name}</span>
                            <span>Page {idx + 1}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Options Sidebar */}
                <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-sm text-xs">
                  <h3 className="font-bold text-slate-900 text-sm border-b pb-3">Image to PDF options</h3>

                  {/* 1. Page Orientation */}
                  <div className="space-y-2">
                    <label className="font-semibold text-slate-700 block">Page orientation</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setImageToPdfOptions({ ...imageToPdfOptions, orientation: 'portrait' })}
                        className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center space-y-1.5 transition cursor-pointer ${
                          imageToPdfOptions.orientation === 'portrait'
                            ? 'border-rose-500 bg-rose-50/50 text-rose-700 font-bold ring-2 ring-rose-500/20'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <RectangleVertical className="w-5 h-5 text-rose-600" />
                        <span>Portrait</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setImageToPdfOptions({ ...imageToPdfOptions, orientation: 'landscape' })}
                        className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center space-y-1.5 transition cursor-pointer ${
                          imageToPdfOptions.orientation === 'landscape'
                            ? 'border-rose-500 bg-rose-50/50 text-rose-700 font-bold ring-2 ring-rose-500/20'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <RectangleHorizontal className="w-5 h-5 text-rose-600" />
                        <span>Landscape</span>
                      </button>
                    </div>
                  </div>

                  {/* 2. Page Size */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <label className="font-semibold text-slate-700 block">Page size</label>
                    <select
                      value={imageToPdfOptions.pageSize}
                      onChange={(e) => setImageToPdfOptions({ ...imageToPdfOptions, pageSize: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    >
                      <option value="a4">A4 (297x210 mm)</option>
                      <option value="fit">Fit (Same page size as image)</option>
                      <option value="letter">US Letter (215.9x279.4 mm)</option>
                    </select>
                  </div>

                  {/* 3. Margin */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="font-semibold text-slate-700 block">Margin</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setImageToPdfOptions({ ...imageToPdfOptions, margin: 'none' })}
                        className={`p-2.5 rounded-xl border text-center flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
                          imageToPdfOptions.margin === 'none'
                            ? 'border-rose-500 bg-rose-50 text-rose-700 font-bold ring-2 ring-rose-500/20'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <Square className="w-4 h-4 text-rose-600" />
                        <span className="text-[11px]">No margin</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setImageToPdfOptions({ ...imageToPdfOptions, margin: 'small' })}
                        className={`p-2.5 rounded-xl border text-center flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
                          imageToPdfOptions.margin === 'small'
                            ? 'border-rose-500 bg-rose-50 text-rose-700 font-bold ring-2 ring-rose-500/20'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <SlidersHorizontal className="w-4 h-4 text-rose-600" />
                        <span className="text-[11px]">Small</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setImageToPdfOptions({ ...imageToPdfOptions, margin: 'big' })}
                        className={`p-2.5 rounded-xl border text-center flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
                          imageToPdfOptions.margin === 'big'
                            ? 'border-rose-500 bg-rose-50 text-rose-700 font-bold ring-2 ring-rose-500/20'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <Maximize2 className="w-4 h-4 text-rose-600" />
                        <span className="text-[11px]">Big</span>
                      </button>
                    </div>
                  </div>

                  {/* 4. Merge Checkbox */}
                  <div className="pt-2 border-t border-slate-100">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={imageToPdfOptions.mergeAll}
                        onChange={(e) => setImageToPdfOptions({ ...imageToPdfOptions, mergeAll: e.target.checked })}
                        className="w-4 h-4 rounded accent-rose-600"
                      />
                      <span className="font-semibold text-slate-800">Merge all images in one PDF file</span>
                    </label>
                  </div>

                  <button
                    onClick={executeAction}
                    disabled={isProcessing || imageCards.length === 0}
                    className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Convert to PDF</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 2. Watermark Studio */}
            {tool.id === 'watermark' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 text-xs font-semibold">
                    <span className="text-slate-600">{files[0]?.name} ({totalPages} Pages)</span>
                    <button
                      type="button"
                      onClick={() => changeFileInputRef.current?.click()}
                      className="text-rose-600 hover:text-rose-700 font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Change File</span>
                    </button>
                  </div>

                  {isRenderingPages ? (
                    <div className="py-32 text-center text-slate-400 space-y-2">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-fuchsia-500" />
                      <p className="text-sm">Rendering document preview...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 max-h-[560px] overflow-y-auto pr-1">
                      {thumbnails.map((thumb, idx) => {
                        const inRange =
                          thumb.pageNumber >= watermarkOptions.fromPage &&
                          thumb.pageNumber <= watermarkOptions.toPage;
                        return (
                          <div
                            key={thumb.id}
                            className="relative rounded-2xl border-2 border-slate-200 bg-slate-50 shadow-xs overflow-hidden p-3 flex flex-col items-center justify-center min-h-[200px]"
                          >
                            <img src={thumb.dataUrl} alt={`Page ${idx + 1}`} className="max-h-44 object-contain shadow-sm bg-white" />
                            {inRange && !watermarkOptions.isMosaic && (
                              <div
                                className={`absolute w-4 h-4 bg-rose-500 rounded-full shadow-md border-2 border-white transition-all duration-150 ${getPositionDotClasses(
                                  watermarkOptions.position
                                )}`}
                              />
                            )}
                            {inRange && watermarkOptions.isMosaic && (
                              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 p-4 pointer-events-none">
                                {[...Array(9)].map((_, dotIdx) => (
                                  <div key={dotIdx} className="flex items-center justify-center">
                                    <div className="w-2.5 h-2.5 bg-rose-500/80 rounded-full border border-white" />
                                  </div>
                                ))}
                              </div>
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

                <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm text-xs">
                  <h3 className="font-bold text-slate-900 text-sm border-b pb-3">Watermark options</h3>

                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setWatermarkOptions({ ...watermarkOptions, type: 'text' })}
                      className={`py-2 rounded-xl font-bold flex items-center justify-center space-x-1.5 transition ${
                        watermarkOptions.type === 'text' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Type className="w-4 h-4 text-rose-500" />
                      <span>Place text</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWatermarkOptions({ ...watermarkOptions, type: 'image' })}
                      className={`py-2 rounded-xl font-bold flex items-center justify-center space-x-1.5 transition ${
                        watermarkOptions.type === 'image' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <ImageIcon className="w-4 h-4 text-rose-500" />
                      <span>Place image</span>
                    </button>
                  </div>

                  {watermarkOptions.type === 'text' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Text:</label>
                        <input
                          type="text"
                          value={watermarkOptions.text}
                          onChange={(e) => setWatermarkOptions({ ...watermarkOptions, text: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 block text-[11px]">Text format:</label>
                        <div className="flex items-center space-x-2">
                          <select
                            value={watermarkOptions.fontFamily}
                            onChange={(e) => setWatermarkOptions({ ...watermarkOptions, fontFamily: e.target.value })}
                            className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex-1"
                          >
                            <option value="Helvetica">Arial / Helvetica</option>
                            <option value="Times">Times New Roman</option>
                            <option value="Courier">Courier</option>
                          </select>

                          <div className="flex items-center space-x-0.5 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                            <button
                              type="button"
                              onClick={() => setWatermarkOptions({ ...watermarkOptions, isBold: !watermarkOptions.isBold })}
                              className={`px-2 py-1 font-bold rounded ${watermarkOptions.isBold ? 'bg-rose-500 text-white' : 'text-slate-600'}`}
                            >
                              B
                            </button>
                            <button
                              type="button"
                              onClick={() => setWatermarkOptions({ ...watermarkOptions, isItalic: !watermarkOptions.isItalic })}
                              className={`px-2 py-1 italic rounded ${watermarkOptions.isItalic ? 'bg-rose-500 text-white' : 'text-slate-600'}`}
                            >
                              I
                            </button>
                            <button
                              type="button"
                              onClick={() => setWatermarkOptions({ ...watermarkOptions, isUnderline: !watermarkOptions.isUnderline })}
                              className={`px-2 py-1 underline rounded ${watermarkOptions.isUnderline ? 'bg-rose-500 text-white' : 'text-slate-600'}`}
                            >
                              U
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Image:</label>
                      <label className="flex items-center justify-center space-x-2 p-3 bg-rose-50 hover:bg-rose-100 border-2 border-dashed border-rose-300 text-rose-700 font-bold rounded-2xl cursor-pointer transition">
                        <ImageIcon className="w-4 h-4" />
                        <span>{watermarkOptions.imageFile ? watermarkOptions.imageFile.name : 'ADD IMAGE'}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          onChange={handleWatermarkImageUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}

                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <label className="font-semibold text-slate-700 block">Position:</label>
                    <div className="flex items-center space-x-4">
                      <div className="grid grid-cols-3 gap-1 w-20 h-20 border border-slate-300 rounded-xl p-1 bg-slate-50">
                        {[
                          'top-left', 'top-center', 'top-right',
                          'middle-left', 'middle-center', 'middle-right',
                          'bottom-left', 'bottom-center', 'bottom-right'
                        ].map((pos) => (
                          <button
                            key={pos}
                            type="button"
                            disabled={watermarkOptions.isMosaic}
                            onClick={() => setWatermarkOptions({ ...watermarkOptions, position: pos })}
                            className={`rounded-md transition-colors flex items-center justify-center ${
                              watermarkOptions.position === pos && !watermarkOptions.isMosaic
                                ? 'bg-rose-500 text-white shadow-xs'
                                : 'bg-white hover:bg-slate-200 border border-slate-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${watermarkOptions.position === pos && !watermarkOptions.isMosaic ? 'bg-white' : 'bg-slate-400'}`} />
                          </button>
                        ))}
                      </div>

                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={watermarkOptions.isMosaic}
                          onChange={(e) => setWatermarkOptions({ ...watermarkOptions, isMosaic: e.target.checked })}
                          className="w-4 h-4 rounded accent-rose-500"
                        />
                        <span className="font-bold text-slate-700">Mosaic</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Transparency:</label>
                      <select
                        value={watermarkOptions.opacity}
                        onChange={(e) => setWatermarkOptions({ ...watermarkOptions, opacity: parseFloat(e.target.value) })}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value="1.0">No transparency</option>
                        <option value="0.75">25% (Light)</option>
                        <option value="0.5">50% (Recommended)</option>
                        <option value="0.25">75% (Faint)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Rotation:</label>
                      <select
                        value={watermarkOptions.rotation}
                        onChange={(e) => setWatermarkOptions({ ...watermarkOptions, rotation: parseInt(e.target.value, 10) })}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value="0">Do not rotate</option>
                        <option value="45">45 Degrees</option>
                        <option value="90">90 Degrees</option>
                        <option value="180">180 Degrees</option>
                        <option value="270">270 Degrees</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <label className="font-semibold text-slate-700 block mb-1">Pages:</label>
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-500">from page</span>
                      <input
                        type="number"
                        min="1"
                        max={totalPages}
                        value={watermarkOptions.fromPage}
                        onChange={(e) => setWatermarkOptions({ ...watermarkOptions, fromPage: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        className="w-14 px-2 py-1 text-center bg-slate-50 border border-slate-200 rounded-lg font-medium"
                      />
                      <span className="text-slate-500">to</span>
                      <input
                        type="number"
                        min="1"
                        max={totalPages}
                        value={watermarkOptions.toPage}
                        onChange={(e) => setWatermarkOptions({ ...watermarkOptions, toPage: Math.min(totalPages, parseInt(e.target.value, 10) || totalPages) })}
                        className="w-14 px-2 py-1 text-center bg-slate-50 border border-slate-200 rounded-lg font-medium"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <label className="font-semibold text-slate-700 block">Layer:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setWatermarkOptions({ ...watermarkOptions, layer: 'over' })}
                        className={`p-2.5 rounded-xl border text-center transition ${
                          watermarkOptions.layer === 'over'
                            ? 'border-rose-500 bg-rose-50 text-rose-700 font-bold'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                      >
                        Over the PDF content
                      </button>
                      <button
                        type="button"
                        onClick={() => setWatermarkOptions({ ...watermarkOptions, layer: 'below' })}
                        className={`p-2.5 rounded-xl border text-center transition ${
                          watermarkOptions.layer === 'below'
                            ? 'border-rose-500 bg-rose-50 text-rose-700 font-bold'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                      >
                        Below the PDF content
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={executeAction}
                    disabled={isProcessing || isRenderingPages}
                    className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Add watermark</span><ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {/* 3. Page Numbers Studio */}
            {tool.id === 'page-numbers' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 text-xs font-semibold">
                    <span className="text-slate-600">{files[0]?.name} ({totalPages} Pages)</span>
                    <button
                      type="button"
                      onClick={() => changeFileInputRef.current?.click()}
                      className="text-rose-600 hover:text-rose-700 font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Change File</span>
                    </button>
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
                                  pageNumberOptions.position
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
                    className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Add page numbers</span><ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {/* 3. Rotate PDF Studio */}
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
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold transition flex items-center space-x-1 shadow-sm cursor-pointer"
                    >
                      <RotateCw className="w-4 h-4" />
                      <span>Rotate All 90°</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => rotateAllPages(-90)}
                      className="px-3 py-2 bg-white hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl font-semibold transition flex items-center space-x-1 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>-90°</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => changeFileInputRef.current?.click()}
                      className="px-3 py-2 bg-white hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl font-semibold transition flex items-center space-x-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Change</span>
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
                        <button onClick={() => rotateSinglePage(idx, 90)} className="p-2 bg-white/95 text-slate-700 rounded-xl shadow hover:text-purple-600 transition cursor-pointer">
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

                <button onClick={executeAction} disabled={isProcessing} className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer">
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Save Rotated PDF</span>}
                </button>
              </div>
            )}

            {/* 4. Organize PDF Studio */}
            {tool.id === 'organize' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Drag & drop pages to rearrange. Hover to rotate or delete individual pages.</span>
                  <button
                    type="button"
                    onClick={() => changeFileInputRef.current?.click()}
                    className="text-amber-700 hover:text-amber-800 font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Change File</span>
                  </button>
                </div>
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
                        <button onClick={() => rotateSinglePage(idx, 90)} className="p-1.5 bg-white text-slate-700 rounded-lg shadow hover:text-amber-600 cursor-pointer"><RotateCw className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteSinglePage(idx)} className="p-1.5 bg-white text-slate-700 rounded-lg shadow hover:text-red-600 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="px-2 py-1 bg-white border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                        <span>Pos: {idx + 1}</span>
                        {thumb.rotation !== 0 && <span className="text-amber-600 font-bold">{thumb.rotation}°</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={executeAction} disabled={isProcessing} className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer">
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Save Organized PDF</span>}
                </button>
              </div>
            )}

            {/* 5. Remove / Extract Pages Studio */}
            {(tool.id === 'remove' || tool.id === 'extract') && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Pages to {tool.id === 'remove' ? 'remove' : 'extract'} (Type range or click thumbnails):</span>
                  <button
                    type="button"
                    onClick={() => changeFileInputRef.current?.click()}
                    className="text-rose-600 hover:text-rose-700 font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Change File</span>
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. 1, 3-5, 8"
                  value={rangeInput}
                  onChange={handleRangeInputChange}
                  className="w-full px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />

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
                  className={`w-full py-4 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer ${
                    tool.id === 'remove' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>{tool.id === 'remove' ? `Remove ${selectedPages.size} Pages` : `Extract ${selectedPages.size} Pages`}</span>}
                </button>
              </div>
            )}

            {/* 6. Compress PDF Studio */}
            {tool.id === 'compress' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-2xl mx-auto space-y-6 shadow-sm">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                  <div className="flex items-center space-x-2.5 truncate">
                    <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="font-bold text-slate-800 truncate">{files[0]?.name}</span>
                    <span className="text-slate-400 font-medium">({formatFileSize(files[0]?.size)})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => changeFileInputRef.current?.click()}
                    className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Change File</span>
                  </button>
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
                        className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
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

                <button onClick={executeAction} disabled={isProcessing} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer">
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Compress PDF (~{compressionPercent}%)</span>}
                </button>
              </div>
            )}

            {/* 7. Single File Conversions (Word to PDF, PPT to PDF, Excel to PDF, HTML to PDF) */}
            {['word-to-pdf', 'powerpoint-to-pdf', 'excel-to-pdf', 'html-to-pdf', 'pdf-to-word', 'pdf-to-powerpoint', 'pdf-to-excel', 'pdf-to-jpg', 'to-markdown'].includes(tool.id) && (
              <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-lg mx-auto space-y-6 shadow-sm">
                <div className="space-y-4">
                  <div className="text-center font-bold text-xs uppercase tracking-wider text-slate-400">
                    Uploaded Document
                  </div>

                  {files[0] && renderSingleFileThumbnailCard(files[0])}

                  {tool.id === 'html-to-pdf' && htmlInputMode === 'code' && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs text-slate-600 truncate">
                      {rawHtmlCode.substring(0, 100)}...
                    </div>
                  )}
                </div>

                <button
                  onClick={executeAction}
                  disabled={isProcessing}
                  className={`w-full py-4 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer ${
                    tool.id === 'word-to-pdf' || tool.id === 'pdf-to-word' ? 'bg-blue-600 hover:bg-blue-700' :
                    tool.id === 'powerpoint-to-pdf' || tool.id === 'pdf-to-powerpoint' ? 'bg-orange-600 hover:bg-orange-700' :
                    tool.id === 'excel-to-pdf' || tool.id === 'pdf-to-excel' ? 'bg-emerald-600 hover:bg-emerald-700' :
                    tool.id === 'html-to-pdf' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isProcessing ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Converting document...</span>
                    </div>
                  ) : (
                    <>
                      <span>Convert to PDF</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* 8. Merge PDF Multi-File Workspace */}
            {tool.id === 'merge' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-xl mx-auto space-y-6 shadow-sm">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      PDF Documents to Merge ({files.length})
                    </span>

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
                        <div className="flex items-center space-x-1 shrink-0">
                          <button onClick={() => moveFileItem(idx, -1)} disabled={idx === 0} className="p-1 text-slate-500 hover:bg-slate-200 rounded disabled:opacity-20 cursor-pointer" title="Move Up"><ArrowUp className="w-3.5 h-3.5" /></button>
                          <button onClick={() => moveFileItem(idx, 1)} disabled={idx === files.length - 1} className="p-1 text-slate-500 hover:bg-slate-200 rounded disabled:opacity-20 cursor-pointer" title="Move Down"><ArrowDown className="w-3.5 h-3.5" /></button>
                          <button onClick={() => removeFileItem(idx)} className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {files.length < 2 && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-2xl font-medium">
                      At least 2 PDF files are required to merge. Please add more files using the button above.
                    </p>
                  )}
                </div>

                <button
                  onClick={executeAction}
                  disabled={isProcessing || files.length < 2}
                  className="w-full py-4 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Merge {files.length} PDFs</span>}
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