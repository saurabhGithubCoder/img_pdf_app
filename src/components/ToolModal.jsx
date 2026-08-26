import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  ArrowRight,
  X,
  Download,
  ArrowUp,
  ArrowDown,
  Trash2,
  FileText,
  AlertCircle,
  Lock,
  Loader2,
  Check,
  RotateCw,
  GripVertical,
  Sliders,
  TrendingDown,
  RotateCcw,
  Image as ImageIcon,
  Code,
  Info
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
  checkPdfPassword,
  convertWordToPDF,
  checkDocxPassword,
  convertPowerpointToPDF,
  checkPptxPassword,
  convertHtmlToPDF,
  convertExcelToPDF,
  checkExcelPassword,
  convertPdfToWord,
  convertPdfToPowerpoint,
  convertPdfToExcel
} from '../utils/pdfWorker';

export default function ToolModal({ tool, onClose }) {
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [lockedFileNames, setLockedFileNames] = useState([]);

  // JPG to PDF State
  const [imageCards, setImageCards] = useState([]);
  const [draggedImageIndex, setDraggedImageIndex] = useState(null);

  // Compression tool settings
  const [compressionPercent, setCompressionPercent] = useState(45);

  // HTML Tool settings
  const [htmlInputMode, setHtmlInputMode] = useState('file');
  const [rawHtmlCode, setRawHtmlCode] = useState('');

  // Page-selector & Visual tools ('remove', 'extract', 'organize', 'rotate')
  const isPageLevelTool =
    tool.id === 'remove' ||
    tool.id === 'extract' ||
    tool.id === 'organize' ||
    tool.id === 'rotate';

  const [thumbnails, setThumbnails] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [isRenderingPages, setIsRenderingPages] = useState(false);
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [rangeInput, setRangeInput] = useState('');
  const [draggedPageIndex, setDraggedPageIndex] = useState(null);

  useEffect(() => {
    if (isPageLevelTool && files.length > 0) {
      loadDocumentThumbnails(files[0]);
    } else if (
      (tool.id === 'compress' ||
        tool.id === 'pdf-to-word' ||
        tool.id === 'pdf-to-powerpoint' ||
        tool.id === 'pdf-to-excel') &&
      files.length > 0
    ) {
      validateCompressTarget(files[0]);
    } else if (tool.id === 'word-to-pdf' && files.length > 0) {
      validateWordTarget(files[0]);
    } else if (tool.id === 'powerpoint-to-pdf' && files.length > 0) {
      validatePowerpointTarget(files[0]);
    } else if (tool.id === 'excel-to-pdf' && files.length > 0) {
      validateExcelTarget(files[0]);
    }
  }, [files, tool.id]);

  const validateCompressTarget = async (file) => {
    setErrorMsg('');
    setLockedFileNames([]);
    const isLocked = await checkPdfPassword(file);
    if (isLocked) {
      setLockedFileNames([file.name]);
      setErrorMsg(`Cannot process: "${file.name}" is password-protected or encrypted.`);
    }
  };

  const validateWordTarget = async (file) => {
    setErrorMsg('');
    setLockedFileNames([]);
    const isLocked = await checkDocxPassword(file);
    if (isLocked) {
      setLockedFileNames([file.name]);
      setErrorMsg(`Cannot process: "${file.name}" is password-protected or encrypted.`);
    }
  };

  const validatePowerpointTarget = async (file) => {
    setErrorMsg('');
    setLockedFileNames([]);
    const isLocked = await checkPptxPassword(file);
    if (isLocked) {
      setLockedFileNames([file.name]);
      setErrorMsg(`Cannot process: "${file.name}" is password-protected or encrypted.`);
    }
  };

  const validateExcelTarget = async (file) => {
    setErrorMsg('');
    setLockedFileNames([]);
    const isLocked = await checkExcelPassword(file);
    if (isLocked) {
      setLockedFileNames([file.name]);
      setErrorMsg(`Cannot process: "${file.name}" is password-protected or encrypted.`);
    }
  };

  const loadDocumentThumbnails = async (file) => {
    setErrorMsg('');
    setLockedFileNames([]);
    setIsRenderingPages(true);
    setThumbnails([]);
    setSelectedPages(new Set());
    setRangeInput('');

    try {
      const data = await renderPdfThumbnails(file);
      setThumbnails(data.thumbnails);
      setTotalPages(data.totalPages);
    } catch (err) {
      if (err.lockedFiles) {
        setLockedFileNames(err.lockedFiles);
        setErrorMsg(`Cannot process: "${file.name}" is password-protected.`);
      } else {
        setErrorMsg('Failed to read PDF pages. The file might be corrupted.');
      }
    } finally {
      setIsRenderingPages(false);
    }
  };

  const handleFilesAdded = (newFiles) => {
    setErrorMsg('');
    setLockedFileNames([]);

    if (tool.id === 'jpg-to-pdf') {
      const addedList = Array.from(newFiles).map((file) => ({
        id: `img-${Date.now()}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        rotation: 0
      }));
      setImageCards((prev) => [...prev, ...addedList]);
      setFiles((prev) => [...prev, ...Array.from(newFiles)]);
    } else if (
      isPageLevelTool ||
      tool.id === 'compress' ||
      tool.id === 'word-to-pdf' ||
      tool.id === 'powerpoint-to-pdf' ||
      tool.id === 'excel-to-pdf' ||
      tool.id === 'html-to-pdf' ||
      tool.id === 'pdf-to-word' ||
      tool.id === 'pdf-to-powerpoint' ||
      tool.id === 'pdf-to-excel'
    ) {
      setFiles([newFiles[0]]);
    } else {
      setFiles((prev) => [...prev, ...Array.from(newFiles)]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      handleFilesAdded(e.dataTransfer.files);
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
    const removedFile = files[index];
    setFiles(files.filter((_, idx) => idx !== index));
    setLockedFileNames((prev) => prev.filter((name) => name !== removedFile.name));
    if (lockedFileNames.length <= 1) setErrorMsg('');
    if (isPageLevelTool) {
      setThumbnails([]);
      setSelectedPages(new Set());
    }
  };

  const handleGoBackToSettings = () => {
    if (result?.url) {
      URL.revokeObjectURL(result.url);
    }
    setResult(null);
    setErrorMsg('');
  };

  const executeAction = async () => {
    setErrorMsg('');
    setLockedFileNames([]);

    if (tool.id === 'merge' && files.length < 2) {
      setErrorMsg('Please upload at least 2 PDF files to merge.');
      return;
    }

    if (tool.id === 'jpg-to-pdf' && imageCards.length === 0) {
      setErrorMsg('Please upload at least 1 image file.');
      return;
    }

    if (tool.id === 'html-to-pdf' && htmlInputMode === 'code' && !rawHtmlCode.trim()) {
      setErrorMsg('Please enter HTML markup to convert.');
      return;
    }

    if (tool.id !== 'html-to-pdf' && files.length === 0 && imageCards.length === 0) {
      setErrorMsg('Please select at least one file.');
      return;
    }

    if ((tool.id === 'remove' || tool.id === 'extract') && selectedPages.size === 0) {
      setErrorMsg(`Please select at least one page to ${tool.id === 'remove' ? 'remove' : 'extract'}.`);
      return;
    }

    if (tool.id === 'remove' && selectedPages.size >= totalPages) {
      setErrorMsg('You cannot remove all pages from the document.');
      return;
    }

    setIsProcessing(true);

    try {
      let output;

      switch (tool.id) {
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
          await new Promise((res) => setTimeout(res, 800));
          output = {
            blob: files[0],
            filename: `processed_${files[0].name}`
          };
      }

      const url = URL.createObjectURL(output.blob);
      setResult({
        url,
        filename: output.filename,
        originalSize: output.originalSize,
        compressedSize: output.compressedSize
      });
    } catch (err) {
      console.error(err);
      if (err.lockedFiles && err.lockedFiles.length > 0) {
        setLockedFileNames(err.lockedFiles);
        setErrorMsg(
          err.lockedFiles.length === 1
            ? `Cannot process: "${err.lockedFiles[0]}" is password-protected.`
            : `Cannot process: The following ${err.lockedFiles.length} files are password-protected:`
        );
      } else {
        setErrorMsg(err.message || 'An error occurred during processing.');
      }
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

  const getFileInputAccept = () => {
    if (tool.id === 'jpg-to-pdf') return 'image/jpeg,image/png,image/webp';
    if (tool.id === 'word-to-pdf') return '.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword';
    if (tool.id === 'powerpoint-to-pdf') return '.pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint';
    if (tool.id === 'excel-to-pdf') return '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
    if (tool.id === 'html-to-pdf') return '.html,.htm,text/html';
    return 'application/pdf';
  };

  const getUploadFileLabel = () => {
    if (tool.id === 'jpg-to-pdf') return 'images';
    if (tool.id === 'word-to-pdf') return 'Word documents (.docx)';
    if (tool.id === 'powerpoint-to-pdf') return 'PowerPoint presentations (.pptx)';
    if (tool.id === 'excel-to-pdf') return 'Excel spreadsheets (.xlsx)';
    if (tool.id === 'html-to-pdf') return 'HTML files (.html)';
    return 'PDFs';
  };

  const isConvertingTool = [
    'word-to-pdf',
    'powerpoint-to-pdf',
    'excel-to-pdf',
    'html-to-pdf',
    'pdf-to-word',
    'pdf-to-powerpoint',
    'pdf-to-excel',
    'pdf-to-jpg',
    'to-markdown',
    'jpg-to-pdf'
  ].includes(tool.id);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`bg-white rounded-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-150 ${
        (isPageLevelTool && thumbnails.length > 0) || (tool.id === 'jpg-to-pdf' && imageCards.length > 0) ? 'max-w-4xl' : 'max-w-xl'
      }`}>
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className={`w-10 h-10 rounded-xl ${tool.bg} ${tool.color} flex items-center justify-center`}>
            <tool.icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{tool.name}</h3>
            <p className="text-xs text-slate-500">Secure File Workspace</p>
          </div>
        </div>

        {/* Error Notice */}
        {errorMsg && (
          <div className={`mb-4 p-3.5 border rounded-2xl text-xs leading-relaxed ${
            lockedFileNames.length > 0 ? 'bg-amber-50 border-amber-200 text-amber-950' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <div className="flex items-start space-x-2.5">
              {lockedFileNames.length > 0 ? (
                <Lock className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-bold">{lockedFileNames.length > 0 ? 'Protected File Detected' : 'Notice'}</p>
                <p className="mt-0.5">{errorMsg}</p>
                {lockedFileNames.length > 1 && (
                  <ul className="mt-2 space-y-1 pl-2 border-l-2 border-amber-300">
                    {lockedFileNames.map((name, i) => (
                      <li key={i} className="font-semibold text-amber-900 truncate">• {name}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {!result ? (
          <>
            {/* HTML Input Tabs */}
            {tool.id === 'html-to-pdf' && (
              <div className="flex border-b border-slate-100 mb-4 pb-2 space-x-4 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => { setHtmlInputMode('file'); setErrorMsg(''); }}
                  className={`flex items-center space-x-1.5 pb-1 border-b-2 transition ${
                    htmlInputMode === 'file' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Upload .HTML File</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setHtmlInputMode('code'); setErrorMsg(''); }}
                  className={`flex items-center space-x-1.5 pb-1 border-b-2 transition ${
                    htmlInputMode === 'code' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>Paste HTML Code</span>
                </button>
              </div>
            )}

            {/* Custom Banner Notes for Tools */}
            {tool.id === 'compress' && files.length > 0 && (
              <div className="mb-4 p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start space-x-2.5 text-xs text-emerald-900">
                <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p>We try our best to compress your PDF while preserving high visual quality and text clarity.</p>
              </div>
            )}

            {tool.id === 'word-to-pdf' && files.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-start space-x-2.5 text-xs text-blue-900">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p>We try our best to convert your Word document to PDF maintaining an exact visual match and layout.</p>
              </div>
            )}

            {tool.id === 'html-to-pdf' && (
              <div className="mb-4 p-3 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-start space-x-2.5 text-xs text-amber-900">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p><strong>Under Development:</strong> HTML conversion is actively being refined and may not capture complex external CSS/scripts accurately.</p>
              </div>
            )}

            {['pdf-to-word', 'pdf-to-powerpoint', 'pdf-to-excel'].includes(tool.id) && files.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-start space-x-2.5 text-xs text-amber-900">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p><strong>Experimental Feature:</strong> This converter is under active development and testing. Complex vector layouts and tables may differ slightly from the source PDF.</p>
              </div>
            )}

            {tool.id === 'html-to-pdf' && htmlInputMode === 'code' ? (
              <div className="space-y-2">
                <textarea
                  rows="9"
                  value={rawHtmlCode}
                  onChange={(e) => setRawHtmlCode(e.target.value)}
                  placeholder="<!DOCTYPE html>&#10;<html>&#10;  <head><style>h1 { color: #d97706; }</style></head>&#10;  <body>&#10;    <h1>Hello World</h1>&#10;    <p>This will be rendered cleanly to PDF.</p>&#10;  </body>&#10;</html>"
                  className="w-full font-mono text-xs p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
            ) : files.length === 0 && imageCards.length === 0 ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-slate-200 hover:border-rose-400 rounded-2xl p-8 text-center bg-slate-50/50 hover:bg-rose-50/30 transition cursor-pointer"
              >
                <input
                  type="file"
                  id="fileInput"
                  multiple={tool.id === 'merge' || tool.id === 'jpg-to-pdf'}
                  accept={getFileInputAccept()}
                  className="hidden"
                  onChange={(e) => handleFilesAdded(e.target.files)}
                />
                <label htmlFor="fileInput" className="cursor-pointer space-y-1 block">
                  <UploadCloud className="w-10 h-10 text-slate-400 mx-auto" />
                  <p className="text-sm font-medium text-slate-700">
                    Drop {getUploadFileLabel()} here or <span className="text-rose-500">browse</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    {tool.id === 'jpg-to-pdf'
                      ? 'Supports JPG, PNG, and WebP images'
                      : tool.id === 'word-to-pdf'
                      ? 'Supports .docx and .doc files'
                      : tool.id === 'powerpoint-to-pdf'
                      ? 'Supports .pptx and .ppt presentations'
                      : tool.id === 'excel-to-pdf'
                      ? 'Supports .xlsx and .xls spreadsheets'
                      : tool.id === 'html-to-pdf'
                      ? 'Supports .html and .htm files'
                      : 'Upload your document'}
                  </p>
                </label>
              </div>
            ) : null}

            {/* Custom Interactive Workspace for Rotate PDF */}
            {tool.id === 'rotate' && files.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-purple-50/80 rounded-2xl border border-purple-200 text-xs">
                  <div className="flex items-center space-x-2 truncate">
                    <FileText className="w-4 h-4 text-purple-600 shrink-0" />
                    <span className="font-semibold text-purple-950 truncate">{files[0].name}</span>
                    <span className="text-purple-600 font-medium">({thumbnails.length} pages)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => rotateAllPages(90)}
                      className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition flex items-center space-x-1 shadow-sm"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Rotate All 90°</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => rotateAllPages(-90)}
                      className="px-2.5 py-1.5 bg-white hover:bg-purple-100/60 text-purple-700 border border-purple-300 rounded-lg font-medium transition flex items-center space-x-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>-90°</span>
                    </button>
                    <button
                      onClick={() => removeFileItem(0)}
                      className="text-purple-700 hover:text-purple-900 font-medium pl-1"
                    >
                      Change
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
                  <span>Click page buttons to rotate individual pages, or rotate all above.</span>
                  <span>{thumbnails.length} Pages</span>
                </div>

                {isRenderingPages ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto text-purple-500" />
                    <p className="text-xs">Generating page previews...</p>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto p-3 bg-slate-100/60 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
                    {thumbnails.map((thumb, idx) => (
                      <div
                        key={thumb.id}
                        className="group relative rounded-xl border-2 bg-white shadow-sm overflow-hidden border-slate-200 hover:border-purple-400 hover:shadow-md transition-all"
                      >
                        <div className="p-2 flex items-center justify-center min-h-[140px] bg-slate-50">
                          <img
                            src={thumb.dataUrl}
                            alt={`Page ${idx + 1}`}
                            style={{ transform: `rotate(${thumb.rotation}deg)` }}
                            className="max-h-32 object-contain transition-transform duration-200"
                          />
                        </div>

                        <div className="absolute top-1.5 right-1.5 flex items-center space-x-1 opacity-95 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => rotateSinglePage(idx, 90)}
                            className="p-1.5 bg-white/95 hover:bg-white text-slate-700 rounded-lg shadow hover:text-purple-600 transition"
                            title="Rotate 90° Clockwise"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="px-2 py-1.5 bg-white border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                          <span>Page {idx + 1}</span>
                          <span className={`${thumb.rotation !== 0 ? 'text-purple-600 font-bold' : 'text-slate-400'}`}>
                            {thumb.rotation}°
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Custom Interactive Workspace for JPG to PDF */}
            {tool.id === 'jpg-to-pdf' && imageCards.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-yellow-50/80 rounded-2xl border border-yellow-200 text-xs">
                  <div className="flex items-center space-x-2">
                    <ImageIcon className="w-4 h-4 text-yellow-600 shrink-0" />
                    <span className="font-semibold text-yellow-950">
                      {imageCards.length} {imageCards.length === 1 ? 'Image Selected' : 'Images Selected'}
                    </span>
                  </div>
                  <label htmlFor="moreImagesInput" className="text-yellow-700 hover:text-yellow-800 font-semibold cursor-pointer">
                    + Add More
                    <input
                      type="file"
                      id="moreImagesInput"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleFilesAdded(e.target.files)}
                    />
                  </label>
                </div>

                <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
                  <span>Hold & drag images to rearrange conversion order.</span>
                  <span>Order: Left to Right, Top to Bottom</span>
                </div>

                <div className="max-h-72 overflow-y-auto p-3 bg-slate-100/60 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                  {imageCards.map((card, idx) => (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={(e) => handleImageDragStart(e, idx)}
                      onDragOver={handleImageDragOver}
                      onDrop={(e) => handleImageDrop(e, idx)}
                      className={`group relative rounded-xl border-2 bg-white shadow-sm overflow-hidden cursor-grab active:cursor-grabbing transition-all ${
                        draggedImageIndex === idx ? 'opacity-40 scale-95 border-yellow-400' : 'border-slate-200 hover:border-yellow-400 hover:shadow-md'
                      }`}
                    >
                      <div className="p-2 flex items-center justify-center min-h-[130px] bg-slate-50">
                        <img
                          src={card.previewUrl}
                          alt={card.file.name}
                          style={{ transform: `rotate(${card.rotation}deg)` }}
                          className="max-h-28 object-contain transition-transform duration-200"
                        />
                      </div>

                      <div className="absolute top-1.5 right-1.5 flex items-center space-x-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => rotateImageCard(idx)}
                          className="p-1.5 bg-white/90 hover:bg-white text-slate-700 rounded-lg shadow hover:text-yellow-600 transition"
                          title="Rotate 90° Clockwise"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteImageCard(idx)}
                          className="p-1.5 bg-white/90 hover:bg-white text-slate-700 rounded-lg shadow hover:text-red-600 transition"
                          title="Remove Image"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="px-2 py-1 bg-white border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                        <div className="flex items-center space-x-1 truncate max-w-[80px]">
                          <GripVertical className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Page {idx + 1}</span>
                        </div>
                        <span className="text-slate-400 truncate">{(card.file.size / 1024).toFixed(0)} KB</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Workspace for "Compress PDF" */}
            {tool.id === 'compress' && files.length > 0 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                  <div className="flex items-center space-x-2.5 truncate">
                    <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-slate-800 truncate">{files[0].name}</span>
                    <span className="text-slate-400 font-medium">({formatFileSize(files[0].size)})</span>
                  </div>
                  <button
                    onClick={() => removeFileItem(0)}
                    className="text-rose-600 hover:text-rose-700 font-semibold"
                  >
                    Change
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Compression Quality Mode
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { percent: 25, label: 'Low', desc: 'Maximum Quality' },
                      { percent: 45, label: 'Recommended', desc: 'Balanced Quality & Size', highlight: true },
                      { percent: 75, label: 'High', desc: 'Smallest File Size' }
                    ].map((preset) => {
                      const isActive = compressionPercent === preset.percent;
                      return (
                        <button
                          key={preset.percent}
                          type="button"
                          onClick={() => setCompressionPercent(preset.percent)}
                          className={`p-3 rounded-2xl border text-left transition ${
                            isActive
                              ? 'border-emerald-500 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold ${isActive ? 'text-emerald-700' : 'text-slate-800'}`}>
                              {preset.label}
                            </span>
                            <span className={`text-[10px] font-semibold ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                              ~{preset.percent}%
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{preset.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-slate-500" />
                      Target Compression Ratio
                    </span>
                    <span className="font-bold text-emerald-600 bg-emerald-100/60 px-2 py-0.5 rounded-full">
                      {compressionPercent}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={compressionPercent}
                    onChange={(e) => setCompressionPercent(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium px-0.5">
                    <span>10% (Ultra High Quality)</span>
                    <span>90% (Maximum Compression)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Visual Workspace for "Organize PDF" */}
            {tool.id === 'organize' && files.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                  <div className="flex items-center space-x-2 truncate">
                    <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="font-semibold truncate">{files[0].name}</span>
                    <span className="text-slate-400">({thumbnails.length} pages)</span>
                  </div>
                  <button
                    onClick={() => removeFileItem(0)}
                    className="text-amber-600 hover:text-amber-700 font-medium self-end sm:self-auto"
                  >
                    Change File
                  </button>
                </div>

                <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
                  <span>Hold & drag pages to reorder. Use hover actions to rotate or delete.</span>
                  <span>{thumbnails.length} Pages</span>
                </div>

                {isRenderingPages ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto text-amber-500" />
                    <p className="text-xs">Generating and analyzing pages...</p>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto p-3 bg-slate-100/60 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
                    {thumbnails.map((thumb, idx) => (
                      <div
                        key={thumb.id}
                        draggable
                        onDragStart={(e) => handlePageDragStart(e, idx)}
                        onDragOver={handlePageDragOver}
                        onDrop={(e) => handlePageDrop(e, idx)}
                        className={`group relative rounded-xl border-2 bg-white shadow-sm overflow-hidden cursor-grab active:cursor-grabbing transition-all ${
                          draggedPageIndex === idx ? 'opacity-40 scale-95 border-amber-400' : 'border-slate-200 hover:border-amber-400 hover:shadow-md'
                        }`}
                      >
                        <div className="p-2 flex items-center justify-center min-h-[140px] bg-slate-50">
                          <img
                            src={thumb.dataUrl}
                            alt={`Page ${idx + 1}`}
                            style={{ transform: `rotate(${thumb.rotation}deg)` }}
                            className="max-h-32 object-contain transition-transform duration-200"
                          />
                        </div>

                        <div className="absolute top-1.5 right-1.5 flex items-center space-x-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              rotateSinglePage(idx);
                            }}
                            className="p-1.5 bg-white/90 hover:bg-white text-slate-700 rounded-lg shadow hover:text-amber-600 transition"
                            title="Rotate 90° Clockwise"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSinglePage(idx);
                            }}
                            className="p-1.5 bg-white/90 hover:bg-white text-slate-700 rounded-lg shadow hover:text-red-600 transition"
                            title="Remove Page"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="px-2 py-1 bg-white border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                          <div className="flex items-center space-x-1">
                            <GripVertical className="w-3 h-3 text-slate-400" />
                            <span>Pos: {idx + 1}</span>
                          </div>
                          {thumb.rotation !== 0 && (
                            <span className="text-amber-600 font-bold">{thumb.rotation}°</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Visual Page Workspace (Remove & Extract Pages) */}
            {(tool.id === 'remove' || tool.id === 'extract') && files.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                  <div className="flex items-center space-x-2 truncate">
                    <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="font-semibold truncate">{files[0].name}</span>
                    <span className="text-slate-400">({totalPages} pages)</span>
                  </div>
                  <button
                    onClick={() => removeFileItem(0)}
                    className="text-rose-600 hover:text-rose-700 font-medium self-end sm:self-auto"
                  >
                    Change File
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Pages to {tool.id === 'remove' ? 'remove' : 'extract'} (Type range or click thumbnails):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1, 3-5, 8"
                    value={rangeInput}
                    onChange={handleRangeInputChange}
                    className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>

                {isRenderingPages ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto text-rose-500" />
                    <p className="text-xs">Generating page thumbnails...</p>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto p-2 bg-slate-100/60 rounded-2xl border border-slate-200 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {thumbnails.map((thumb) => {
                      const isSelected = selectedPages.has(thumb.pageNumber);
                      const isRemoveMode = tool.id === 'remove';

                      return (
                        <div
                          key={thumb.pageNumber}
                          onClick={() => togglePageSelection(thumb.pageNumber)}
                          className={`group relative rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${
                            isSelected
                              ? isRemoveMode
                                ? 'border-red-500 shadow-md ring-2 ring-red-400/20'
                                : 'border-emerald-500 shadow-md ring-2 ring-emerald-400/20'
                              : 'border-white hover:border-slate-300 shadow-sm'
                          }`}
                        >
                          <img
                            src={thumb.dataUrl}
                            alt={`Page ${thumb.pageNumber}`}
                            className={`w-full h-auto object-cover transition duration-150 ${
                              isSelected
                                ? isRemoveMode
                                  ? 'opacity-40 grayscale'
                                  : 'opacity-85'
                                : 'group-hover:scale-105'
                            }`}
                          />

                          {isSelected && (
                            <div className={`absolute inset-0 flex flex-col items-center justify-center ${
                              isRemoveMode ? 'bg-red-500/20' : 'bg-emerald-500/20'
                            }`}>
                              <div className={`w-6 h-6 rounded-full text-white flex items-center justify-center shadow ${
                                isRemoveMode ? 'bg-red-500' : 'bg-emerald-600'
                              }`}>
                                {isRemoveMode ? <Trash2 className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                            </div>
                          )}

                          <span className={`absolute bottom-1 right-1 text-[10px] font-bold px-1.5 py-0.5 rounded shadow ${
                            isSelected
                              ? isRemoveMode ? 'bg-red-500 text-white' : 'bg-emerald-600 text-white'
                              : 'bg-slate-900/70 text-white'
                          }`}>
                            {thumb.pageNumber}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Standard Multi-File Workspace for Other Tools */}
            {!isPageLevelTool && tool.id !== 'compress' && tool.id !== 'jpg-to-pdf' && (tool.id !== 'html-to-pdf' || htmlInputMode === 'file') && files.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-1">
                  <span>Selected Files ({files.length})</span>
                  {tool.id === 'merge' && <span>Order: Top to Bottom</span>}
                </div>

                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {files.map((file, idx) => {
                    const isFileLocked = lockedFileNames.includes(file.name);
                    return (
                      <div
                        key={`${file.name}-${idx}`}
                        className={`flex items-center justify-between border p-2.5 rounded-xl text-xs transition ${
                          isFileLocked
                            ? 'bg-amber-50/80 border-amber-300 text-amber-900'
                            : 'bg-slate-50 border-slate-200/80 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate pr-2">
                          <span className="font-bold text-slate-400 w-4">{idx + 1}.</span>
                          {isFileLocked ? (
                            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span className="truncate font-medium">{file.name}</span>
                          <span className="text-slate-400 text-[10px] shrink-0">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                          {isFileLocked && (
                            <span className="px-1.5 py-0.5 bg-amber-200 text-amber-800 text-[10px] rounded font-semibold shrink-0">
                              Locked
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          {tool.id === 'merge' && (
                            <>
                              <button
                                type="button"
                                onClick={() => moveFileItem(idx, -1)}
                                disabled={idx === 0}
                                className="p-1 hover:bg-slate-200 disabled:opacity-30 rounded text-slate-600 transition"
                                title="Move Up"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveFileItem(idx, 1)}
                                disabled={idx === files.length - 1}
                                className="p-1 hover:bg-slate-200 disabled:opacity-30 rounded text-slate-600 transition"
                                title="Move Down"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => removeFileItem(idx)}
                            className="p-1 hover:bg-red-100 text-slate-400 hover:text-red-500 rounded transition"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={executeAction}
              disabled={
                (tool.id === 'jpg-to-pdf' && imageCards.length === 0) ||
                (tool.id === 'html-to-pdf' && htmlInputMode === 'code' && !rawHtmlCode.trim()) ||
                (tool.id === 'html-to-pdf' && htmlInputMode === 'file' && files.length === 0) ||
                (!['jpg-to-pdf', 'html-to-pdf'].includes(tool.id) && files.length === 0) ||
                lockedFileNames.length > 0 ||
                (tool.id === 'merge' && files.length < 2) ||
                ((tool.id === 'remove' || tool.id === 'extract') && selectedPages.size === 0) ||
                (tool.id === 'remove' && selectedPages.size >= totalPages) ||
                ((tool.id === 'organize' || tool.id === 'rotate') && thumbnails.length === 0) ||
                isProcessing ||
                isRenderingPages
              }
              className={`mt-6 w-full py-3.5 text-white rounded-xl font-medium shadow-md transition flex items-center justify-center space-x-2 disabled:opacity-50 ${
                tool.id === 'compress'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                  : tool.id === 'jpg-to-pdf'
                  ? 'bg-yellow-600 hover:bg-yellow-700 shadow-yellow-600/20'
                  : tool.id === 'powerpoint-to-pdf' || tool.id === 'pdf-to-powerpoint'
                  ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-600/20'
                  : tool.id === 'excel-to-pdf' || tool.id === 'pdf-to-excel'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                  : tool.id === 'html-to-pdf'
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                  : tool.id === 'pdf-to-word'
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                  : tool.id === 'rotate'
                  ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20'
                  : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20'
              }`}
            >
              {isProcessing ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span className="text-sm font-medium">
                    {tool.id === 'compress'
                      ? 'Compressing file...'
                      : isConvertingTool
                      ? 'Converting your file...'
                      : 'Processing file...'}
                  </span>
                </div>
              ) : (
                <>
                  <span className="text-sm font-medium">
                    {tool.id === 'pdf-to-excel'
                      ? 'Convert PDF to EXCEL'
                      : tool.id === 'pdf-to-powerpoint'
                      ? 'Convert PDF to POWERPOINT'
                      : tool.id === 'rotate'
                      ? `Save Rotated PDF (${thumbnails.length} Pages)`
                      : tool.id === 'pdf-to-word'
                      ? 'Convert PDF to WORD'
                      : tool.id === 'excel-to-pdf'
                      ? 'Convert EXCEL to PDF'
                      : tool.id === 'html-to-pdf'
                      ? 'Convert HTML to PDF'
                      : tool.id === 'powerpoint-to-pdf'
                      ? 'Convert POWERPOINT to PDF'
                      : tool.id === 'word-to-pdf'
                      ? 'Convert WORD to PDF'
                      : tool.id === 'jpg-to-pdf'
                      ? `Convert ${imageCards.length} ${imageCards.length === 1 ? 'Image' : 'Images'} to PDF`
                      : tool.id === 'compress'
                      ? `Compress PDF (~${compressionPercent}%)`
                      : tool.id === 'organize'
                      ? `Save Organized PDF (${thumbnails.length} Pages)`
                      : tool.id === 'remove'
                      ? `Remove ${selectedPages.size} ${selectedPages.size === 1 ? 'Page' : 'Pages'}`
                      : tool.id === 'extract'
                      ? `Extract ${selectedPages.size} ${selectedPages.size === 1 ? 'Page' : 'Pages'}`
                      : tool.id === 'merge'
                      ? `Merge ${files.length} PDFs`
                      : `Run ${tool.name}`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </>
        ) : (
          <div className="text-center py-6 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h4 className="text-lg font-bold text-slate-900">
              {tool.id === 'rotate'
                ? 'PDF Rotated Successfully!'
                : tool.id === 'compress'
                ? 'Compression Complete!'
                : tool.id === 'jpg-to-pdf'
                ? 'Images Converted to PDF!'
                : tool.id === 'word-to-pdf'
                ? 'Word Document Converted to PDF!'
                : tool.id === 'powerpoint-to-pdf'
                ? 'Presentation Converted to PDF!'
                : tool.id === 'excel-to-pdf'
                ? 'Excel Spreadsheet Converted to PDF!'
                : tool.id === 'html-to-pdf'
                ? 'HTML Converted to PDF!'
                : tool.id === 'pdf-to-word'
                ? 'PDF Converted to Word!'
                : tool.id === 'pdf-to-powerpoint'
                ? 'PDF Converted to PowerPoint!'
                : tool.id === 'pdf-to-excel'
                ? 'PDF Converted to Excel!'
                : 'Processing Complete!'}
            </h4>

            {/* Compressed Stats Breakdown */}
            {tool.id === 'compress' && result.originalSize && result.compressedSize && (
              <div className="max-w-xs mx-auto p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-around text-xs">
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Original</p>
                  <p className="font-bold text-slate-700">{formatFileSize(result.originalSize)}</p>
                </div>
                <TrendingDown className="w-4 h-4 text-emerald-600" />
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Compressed</p>
                  <p className="font-bold text-emerald-700">{formatFileSize(result.compressedSize)}</p>
                </div>
                <div className="bg-emerald-600 text-white px-2 py-1 rounded-lg text-[10px] font-extrabold">
                  -{Math.max(0, Math.round(((result.originalSize - result.compressedSize) / result.originalSize) * 100))}%
                </div>
              </div>
            )}

            <p className="text-xs text-slate-500 truncate px-4">
              Generated: <span className="font-semibold text-slate-700">{result.filename}</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              {tool.id === 'compress' && (
                <button
                  onClick={handleGoBackToSettings}
                  className="flex-1 py-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition flex items-center justify-center space-x-1.5 shadow-sm"
                >
                  <RotateCcw className="w-4 h-4 text-slate-500" />
                  <span>Adjust Settings</span>
                </button>
              )}

              <button
                onClick={onClose}
                className={`py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition ${
                  tool.id === 'compress' ? 'px-5' : 'flex-1'
                }`}
              >
                Done
              </button>

              <a
                href={result.url}
                download={result.filename}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium shadow-md shadow-emerald-600/20 text-center flex items-center justify-center space-x-2 transition"
              >
                <Download className="w-4 h-4" />
                <span>
                  Download{' '}
                  {tool.id === 'pdf-to-word'
                    ? 'Word Document'
                    : tool.id === 'pdf-to-powerpoint'
                    ? 'PowerPoint Presentation'
                    : tool.id === 'pdf-to-excel'
                    ? 'Excel Workbook'
                    : 'File'}
                </span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}