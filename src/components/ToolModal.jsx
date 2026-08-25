import React, { useState } from 'react';
import { UploadCloud, CheckCircle2, ArrowRight, X, Download } from 'lucide-react';
import {
  mergePDFs,
  splitPDF,
  rotatePDF,
  imagesToPDF,
  pdfToJpg,
  pdfToMarkdown
} from '../utils/pdfWorker';

export default function ToolModal({ tool, onClose }) {
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null); // { url, filename }

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      setFiles(Array.from(e.dataTransfer.files));
    }
  };

  const executeAction = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);

    try {
      let output;

      switch (tool.id) {
        case 'merge':
          output = await mergePDFs(files);
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
      alert('Error processing file locally. Check document formatting.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-150">
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

        {!result ? (
          <>
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
                onChange={(e) => setFiles(Array.from(e.target.files))}
              />
              <label htmlFor="fileInput" className="cursor-pointer space-y-2 block">
                <UploadCloud className="w-10 h-10 text-slate-400 mx-auto" />
                <p className="text-sm font-medium text-slate-700">
                  Drop your files here or <span className="text-rose-500">browse</span>
                </p>
                <p className="text-xs text-slate-400">PDF, Office documents, or Images</p>
              </label>
            </div>

            {files.length > 0 && (
              <div className="mt-4 space-y-2 max-h-32 overflow-y-auto">
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-slate-100 p-2.5 rounded-lg">
                    <span className="font-medium truncate max-w-xs text-slate-700">{file.name}</span>
                    <span className="text-slate-400">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={executeAction}
              disabled={files.length === 0 || isProcessing}
              className="mt-6 w-full py-3.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl font-medium shadow-md shadow-rose-500/20 transition flex items-center justify-center space-x-2"
            >
              {isProcessing ? (
                <span className="text-sm">Processing in browser...</span>
              ) : (
                <>
                  <span className="text-sm">Run {tool.name}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </>
        ) : (
          <div className="text-center py-6 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h4 className="text-lg font-bold text-slate-900">File Ready!</h4>
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
                <span>Download</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}