import React, { useState } from 'react';
import { UploadCloud, X, Lock, Unlock, AlertCircle, Loader2, ArrowRight, Plus, Trash2, FileText } from 'lucide-react';
import {
  checkPdfPassword,
  checkDocxPassword,
  checkPptxPassword,
  checkExcelPassword
} from '../utils/pdfWorker';

export default function ToolModal({ tool, onClose, onLaunchStudio }) {
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [lockedFiles, setLockedFiles] = useState([]);
  const [htmlMode, setHtmlMode] = useState('file');
  const [rawHtml, setRawHtml] = useState('');
  const [modalFiles, setModalFiles] = useState([]);

  const getFileInputAccept = () => {
    if (tool.id === 'jpg-to-pdf') return 'image/jpeg,image/png,image/webp';
    if (tool.id === 'word-to-pdf') return '.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword';
    if (tool.id === 'powerpoint-to-pdf') return '.pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint';
    if (tool.id === 'excel-to-pdf') return '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
    if (tool.id === 'html-to-pdf') return '.html,.htm,text/html';
    return 'application/pdf';
  };

  const handleFilesSelected = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMsg('');
    setLockedFiles([]);
    setIsVerifying(true);

    const newFilesArray = Array.from(fileList);
    const lockedNames = [];

    try {
      // 1. Password security check
      for (const file of newFilesArray) {
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
          lockedNames.push(file.name);
        }
      }

      // Check for Protect Tool: Block if already protected
      if (tool.id === 'protect' && lockedNames.length > 0) {
        setErrorMsg(`Cannot process: "${lockedNames[0]}" is already password-protected. Please choose an unprotected PDF.`);
        setIsVerifying(false);
        return;
      }

      // Check for Unlock Tool: Must be locked
      if (tool.id === 'unlock') {
        if (lockedNames.length === 0) {
          setErrorMsg(`"${newFilesArray[0].name}" is already unlocked and does not require a password.`);
          setIsVerifying(false);
          return;
        }
        // Proceed to Unlock studio
        onLaunchStudio(tool, { files: newFilesArray, isLocked: true });
        return;
      }

      // Other tools: Block if password protected
      if (tool.id !== 'unlock' && lockedNames.length > 0) {
        setLockedFiles(lockedNames);
        setErrorMsg(
          lockedNames.length === 1
            ? `Cannot process: "${lockedNames[0]}" is password-protected or encrypted. Please select a non-protected file.`
            : `Cannot process: The selected files are password-protected. Please upload unprotected documents.`
        );
        setIsVerifying(false);
        return;
      }

      // For merge tool: accumulate files
      if (tool.id === 'merge') {
        const combined = [...modalFiles, ...newFilesArray];
        setModalFiles(combined);
        setIsVerifying(false);
        return;
      }

      // For jpg-to-pdf: create image cards
      if (tool.id === 'jpg-to-pdf') {
        const imageCards = newFilesArray.map((file) => ({
          id: `img-${Date.now()}-${Math.random()}`,
          file,
          previewUrl: URL.createObjectURL(file),
          rotation: 0
        }));
        onLaunchStudio(tool, { files: newFilesArray, imageCards });
      } else {
        onLaunchStudio(tool, { files: newFilesArray });
      }
    } catch (err) {
      setErrorMsg('Failed to read file. Please ensure the document is not corrupted.');
    } finally {
      setIsVerifying(false);
    }
  };

  const removeModalFile = (index) => {
    setModalFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleLaunchMergeStudio = () => {
    if (modalFiles.length < 2) {
      setErrorMsg('Please upload at least 2 PDF files to merge.');
      return;
    }
    onLaunchStudio(tool, { files: modalFiles });
  };

  const handleHtmlCodeSubmit = () => {
    if (!rawHtml.trim()) {
      setErrorMsg('Please paste HTML code.');
      return;
    }
    onLaunchStudio(tool, { htmlCode: rawHtml, htmlMode: 'code' });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-150">
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
            <p className="text-xs text-slate-500">Security Verification & Upload</p>
          </div>
        </div>

        {/* Notice Box */}
        {errorMsg && (
          <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-950 leading-relaxed">
            <div className="flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Notice</p>
                <p className="mt-1">{errorMsg}</p>
              </div>
            </div>
          </div>
        )}

        {/* HTML Code vs File Tab */}
        {tool.id === 'html-to-pdf' && (
          <div className="flex border-b border-slate-100 mb-4 pb-2 space-x-4 text-xs font-semibold">
            <button
              onClick={() => { setHtmlMode('file'); setErrorMsg(''); }}
              className={`pb-1 border-b-2 transition ${htmlMode === 'file' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-400'}`}
            >
              Upload .HTML File
            </button>
            <button
              onClick={() => { setHtmlMode('code'); setErrorMsg(''); }}
              className={`pb-1 border-b-2 transition ${htmlMode === 'code' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-400'}`}
            >
              Paste HTML Code
            </button>
          </div>
        )}

        {tool.id === 'html-to-pdf' && htmlMode === 'code' ? (
          <div className="space-y-4">
            <textarea
              rows="7"
              value={rawHtml}
              onChange={(e) => setRawHtml(e.target.value)}
              placeholder="<!DOCTYPE html><html><body><h1>Hello World</h1></body></html>"
              className="w-full font-mono text-xs p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
            <button
              onClick={handleHtmlCodeSubmit}
              className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition flex items-center justify-center space-x-2 shadow-md cursor-pointer"
            >
              <span>Continue to Studio</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : tool.id === 'merge' && modalFiles.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Selected PDFs ({modalFiles.length})</span>
              <label htmlFor="modalAddMoreInput" className="text-rose-600 hover:text-rose-700 font-bold cursor-pointer flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />
                <span>Add More</span>
                <input
                  type="file"
                  id="modalAddMoreInput"
                  multiple
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />
              </label>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {modalFiles.map((file, idx) => (
                <div key={`${file.name}-${idx}`} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <div className="flex items-center space-x-2.5 truncate pr-2">
                    <span className="font-bold text-slate-400 w-4">{idx + 1}.</span>
                    <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="truncate font-medium text-slate-700">{file.name}</span>
                    <span className="text-slate-400 text-[10px] shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeModalFile(idx)}
                    className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition shrink-0 cursor-pointer"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {modalFiles.length < 2 && (
              <p className="text-[11px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                Please add at least 1 more PDF file to enable merging.
              </p>
            )}

            <button
              onClick={handleLaunchMergeStudio}
              disabled={modalFiles.length < 2 || isVerifying}
              className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold transition flex items-center justify-center space-x-2 shadow-md cursor-pointer disabled:cursor-not-allowed"
            >
              <span>Continue to Merge Studio ({modalFiles.length} files)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFilesSelected(e.dataTransfer.files);
            }}
            className="border-2 border-dashed border-slate-200 hover:border-rose-400 rounded-2xl p-8 text-center bg-slate-50/50 hover:bg-rose-50/30 transition cursor-pointer"
          >
            <input
              type="file"
              id="modalFileInput"
              multiple={tool.id === 'merge' || tool.id === 'jpg-to-pdf'}
              accept={getFileInputAccept()}
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
            <label htmlFor="modalFileInput" className="cursor-pointer space-y-2 block">
              {isVerifying ? (
                <div className="py-4 space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-rose-500" />
                  <p className="text-xs font-semibold text-slate-600">Verifying file security...</p>
                </div>
              ) : (
                <>
                  <UploadCloud className="w-10 h-10 text-slate-400 mx-auto" />
                  <p className="text-sm font-medium text-slate-700">
                    Drop {tool.id === 'merge' ? '2 or more PDF files' : 'document'} here or <span className="text-rose-500 font-bold">browse</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    {tool.id === 'unlock' ? 'Select the locked PDF to decrypt' : 'Files are checked for password security before editing'}
                  </p>
                </>
              )}
            </label>
          </div>
        )}
      </div>
    </div>
  );
}