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
  Check
} from 'lucide-react';
import {
  mergePDFs,
  splitPDF,
  rotatePDF,
  imagesToPDF,
  pdfToJpg,
  pdfToMarkdown,
  renderPdfThumbnails,
  removePagesFromPDF
} from '../utils/pdfWorker';

export default function ToolModal({ tool, onClose }) {
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [lockedFileNames, setLockedFileNames] = useState([]);

  // Remove Pages specific state
  const [thumbnails, setThumbnails] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [isRenderingPages, setIsRenderingPages] = useState(false);
  const [pagesToRemove, setPagesToRemove] = useState(new Set());
  const [rangeInput, setRangeInput] = useState('');

  // Automatically parse PDF thumbnails when a file is uploaded in 'remove' mode
  useEffect(() => {
    if (tool.id === 'remove' && files.length > 0) {
      loadDocumentThumbnails(files[0]);
    }
  }, [files, tool.id]);

  const loadDocumentThumbnails = async (file) => {
    setErrorMsg('');
    setLockedFileNames([]);
    setIsRenderingPages(true);
    setThumbnails([]);
    setPagesToRemove(new Set());
    setRangeInput('');

    try {
      const data = await renderPdfThumbnails(file);
      setThumbnails(data.thumbnails);
      setTotalPages(data.totalPages);
    } catch (err) {
      if (err.lockedFiles) {
        setLockedFileNames(err.lockedFiles);
        setErrorMsg(`Cannot load thumbnails: "${file.name}" is password-protected.`);
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
    if (tool.id === 'remove') {
      setFiles([newFiles[0]]); // Only 1 file allowed for remove pages
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

  // Convert Set of page numbers to range string (e.g. Set(1,2,3,5) -> "1-3, 5")
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

  // Toggle page removal from thumbnail click
  const togglePageRemoval = (pageNum) => {
    const updated = new Set(pagesToRemove);
    if (updated.has(pageNum)) {
      updated.delete(pageNum);
    } else {
      updated.add(pageNum);
    }
    setPagesToRemove(updated);
    setRangeInput(setToStringRange(updated));
  };

  // Parse text range input (e.g., "1, 3-5, 8")
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

    setPagesToRemove(newSet);
  };

  const moveItem = (index, direction) => {
    const updated = [...files];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= updated.length) return;
    
    const [movedItem] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, movedItem);
    setFiles(updated);
  };

  const removeItem = (index) => {
    const removedFile = files[index];
    setFiles(files.filter((_, idx) => idx !== index));
    setLockedFileNames((prev) => prev.filter((name) => name !== removedFile.name));
    if (lockedFileNames.length <= 1) setErrorMsg('');
    if (tool.id === 'remove') {
      setThumbnails([]);
      setPagesToRemove(new Set());
    }
  };

  const executeAction = async () => {
    setErrorMsg('');
    setLockedFileNames([]);

    if (tool.id === 'merge' && files.length < 2) {
      setErrorMsg('Please upload at least 2 PDF files to merge.');
      return;
    }

    if (files.length === 0) {
      setErrorMsg('Please select at least one file.');
      return;
    }

    if (tool.id === 'remove' && pagesToRemove.size === 0) {
      setErrorMsg('Please select at least one page to remove.');
      return;
    }

    if (tool.id === 'remove' && pagesToRemove.size >= totalPages) {
      setErrorMsg('You cannot remove all pages from the document.');
      return;
    }

    setIsProcessing(true);

    try {
      let output;

      switch (tool.id) {
        case 'merge':
          output = await mergePDFs(files);
          break;
        case 'remove':
          output = await removePagesFromPDF(files[0], pagesToRemove);
          break;
        case 'split':
          output = await splitPDF(files[0]);
          break;
        case 'rotate':
          output = await rotatePDF(files[0]);
          break;
        case 'jpg-to-pdf':
          output = await imagesToPDF(files);
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
      setResult({ url, filename: output.filename });
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`bg-white rounded-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-150 ${
        tool.id === 'remove' && thumbnails.length > 0 ? 'max-w-4xl' : 'max-w-xl'
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
            <p className="text-xs text-slate-500">Client-Side Secure Workspace</p>
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
            {files.length === 0 ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-slate-200 hover:border-rose-400 rounded-2xl p-8 text-center bg-slate-50/50 hover:bg-rose-50/30 transition cursor-pointer"
              >
                <input
                  type="file"
                  id="fileInput"
                  multiple={tool.id === 'merge' || tool.id === 'jpg-to-pdf'}
                  className="hidden"
                  onChange={(e) => handleFilesAdded(e.target.files)}
                />
                <label htmlFor="fileInput" className="cursor-pointer space-y-1 block">
                  <UploadCloud className="w-10 h-10 text-slate-400 mx-auto" />
                  <p className="text-sm font-medium text-slate-700">
                    Drop PDF here or <span className="text-rose-500">browse</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    {tool.id === 'remove' ? 'Select 1 PDF to remove pages' : 'Upload your document'}
                  </p>
                </label>
              </div>
            ) : null}

            {/* Custom Workspace for "Remove Pages" Tool */}
            {tool.id === 'remove' && files.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                  <div className="flex items-center space-x-2 truncate">
                    <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="font-semibold truncate">{files[0].name}</span>
                    <span className="text-slate-400">({totalPages} pages)</span>
                  </div>
                  <button
                    onClick={() => removeItem(0)}
                    className="text-rose-600 hover:text-rose-700 font-medium self-end sm:self-auto"
                  >
                    Change File
                  </button>
                </div>

                {/* Range Input Section */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Pages to remove (Type range or click thumbnails below):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1, 3-5, 8"
                    value={rangeInput}
                    onChange={handleRangeInputChange}
                    className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>

                {/* Thumbnails Grid */}
                {isRenderingPages ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto text-rose-500" />
                    <p className="text-xs">Generating page thumbnails...</p>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto p-2 bg-slate-100/60 rounded-2xl border border-slate-200 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {thumbnails.map((thumb) => {
                      const isSelected = pagesToRemove.has(thumb.pageNumber);
                      return (
                        <div
                          key={thumb.pageNumber}
                          onClick={() => togglePageRemoval(thumb.pageNumber)}
                          className={`group relative rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${
                            isSelected
                              ? 'border-red-500 shadow-md ring-2 ring-red-400/20'
                              : 'border-white hover:border-slate-300 shadow-sm'
                          }`}
                        >
                          <img
                            src={thumb.dataUrl}
                            alt={`Page ${thumb.pageNumber}`}
                            className={`w-full h-auto object-cover transition duration-150 ${
                              isSelected ? 'opacity-40 grayscale' : 'group-hover:scale-105'
                            }`}
                          />

                          {/* Selected Overlay Marker */}
                          {isSelected && (
                            <div className="absolute inset-0 bg-red-500/20 flex flex-col items-center justify-center">
                              <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow">
                                <Trash2 className="w-3.5 h-3.5" />
                              </div>
                            </div>
                          )}

                          {/* Page Number Badge */}
                          <span className={`absolute bottom-1 right-1 text-[10px] font-bold px-1.5 py-0.5 rounded shadow ${
                            isSelected ? 'bg-red-500 text-white' : 'bg-slate-900/70 text-white'
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
            {tool.id !== 'remove' && files.length > 0 && (
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
                                onClick={() => moveItem(idx, -1)}
                                disabled={idx === 0}
                                className="p-1 hover:bg-slate-200 disabled:opacity-30 rounded text-slate-600 transition"
                                title="Move Up"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveItem(idx, 1)}
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
                            onClick={() => removeItem(idx)}
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
                files.length === 0 ||
                (tool.id === 'merge' && files.length < 2) ||
                (tool.id === 'remove' && (pagesToRemove.size === 0 || pagesToRemove.size >= totalPages)) ||
                isProcessing ||
                isRenderingPages
              }
              className="mt-6 w-full py-3.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl font-medium shadow-md shadow-rose-500/20 transition flex items-center justify-center space-x-2"
            >
              {isProcessing ? (
                <span className="text-sm">Processing in browser...</span>
              ) : (
                <>
                  <span className="text-sm">
                    {tool.id === 'remove'
                      ? `Remove ${pagesToRemove.size} ${pagesToRemove.size === 1 ? 'Page' : 'Pages'}`
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
            <h4 className="text-lg font-bold text-slate-900">Pages Removed Successfully!</h4>
            <p className="text-xs text-slate-500 truncate px-4">
              Generated: <span className="font-semibold text-slate-700">{result.filename}</span>
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Close
              </button>
              <a
                href={result.url}
                download={result.filename}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium shadow-md shadow-emerald-600/20 text-center flex items-center justify-center space-x-2 transition"
              >
                <Download className="w-4 h-4" />
                <span>Download Result</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}