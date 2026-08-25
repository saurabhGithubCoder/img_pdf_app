import { PDFDocument, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Check if a file is password protected using pdfjs & pdf-lib
 */
export async function checkPdfPassword(file) {
  const arrayBuffer = await file.arrayBuffer();
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
    await loadingTask.promise;
  } catch (err) {
    if (err.name === 'PasswordException' || err.message?.toLowerCase().includes('password')) {
      return true;
    }
  }

  try {
    await PDFDocument.load(arrayBuffer, { ignoreEncryption: false });
  } catch (err) {
    if (err.message?.toLowerCase().includes('password') || err.message?.toLowerCase().includes('encrypted')) {
      return true;
    }
  }

  return false;
}

/**
 * Render all page thumbnails of a PDF file into base64 image data URLs.
 */
export async function renderPdfThumbnails(file) {
  const isLocked = await checkPdfPassword(file);
  if (isLocked) {
    const err = new Error(`"${file.name}" is password-protected and cannot be processed.`);
    err.lockedFiles = [file.name];
    throw err;
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const thumbnails = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 0.35 }); // Lightweight thumbnail size
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: ctx, viewport }).promise;
    thumbnails.push({
      pageNumber: i,
      dataUrl: canvas.toDataURL('image/jpeg', 0.8)
    });
  }

  return { totalPages: numPages, thumbnails };
}

/**
 * Remove specific page indices (1-based) from a PDF.
 */
export async function removePagesFromPDF(file, pagesToRemoveSet) {
  const isLocked = await checkPdfPassword(file);
  if (isLocked) {
    const err = new Error(`"${file.name}" is password-protected and cannot be processed.`);
    err.lockedFiles = [file.name];
    throw err;
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();

  if (pagesToRemoveSet.size >= totalPages) {
    throw new Error('You cannot remove all pages from the document.');
  }

  const newPdf = await PDFDocument.create();
  const pagesToKeepIndices = [];

  for (let i = 0; i < totalPages; i++) {
    const pageNum = i + 1;
    if (!pagesToRemoveSet.has(pageNum)) {
      pagesToKeepIndices.push(i);
    }
  }

  const copiedPages = await newPdf.copyPages(pdfDoc, pagesToKeepIndices);
  copiedPages.forEach((page) => newPdf.addPage(page));

  const bytes = await newPdf.save();
  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    filename: `edited_${file.name}`
  };
}

/**
 * Helper to safely load a PDFDocument using pdf-lib.
 */
async function loadPdfSafely(file) {
  const isLocked = await checkPdfPassword(file);
  if (isLocked) {
    const err = new Error(`"${file.name}" is password-protected and cannot be processed.`);
    err.lockedFiles = [file.name];
    throw err;
  }

  const arrayBuffer = await file.arrayBuffer();
  return await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
}

/**
 * Helper to safely load a document using pdfjs-dist.
 */
async function loadPdfJsSafely(file) {
  const arrayBuffer = await file.arrayBuffer();
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    return await loadingTask.promise;
  } catch (err) {
    if (err.name === 'PasswordException' || err.message?.toLowerCase().includes('password')) {
      const lockErr = new Error(`"${file.name}" is password-protected and cannot be processed.`);
      lockErr.lockedFiles = [file.name];
      throw lockErr;
    }
    throw err;
  }
}

/**
 * Merge multiple PDF files.
 */
export async function mergePDFs(fileList) {
  const lockedFiles = [];

  for (const file of fileList) {
    const isLocked = await checkPdfPassword(file);
    if (isLocked) {
      lockedFiles.push(file.name);
    }
  }

  if (lockedFiles.length > 0) {
    const err = new Error('Password-protected files detected.');
    err.lockedFiles = lockedFiles;
    throw err;
  }

  const mergedPdf = await PDFDocument.create();

  for (const file of fileList) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const bytes = await mergedPdf.save();
  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    filename: 'merged_document.pdf'
  };
}

/**
 * Split PDF: Extract each page into separate PDFs inside a ZIP.
 */
export async function splitPDF(file) {
  const pdfDoc = await loadPdfSafely(file);
  const totalPages = pdfDoc.getPageCount();
  const zip = new JSZip();

  for (let i = 0; i < totalPages; i++) {
    const singleDoc = await PDFDocument.create();
    const [copiedPage] = await singleDoc.copyPages(pdfDoc, [i]);
    singleDoc.addPage(copiedPage);
    const singleBytes = await singleDoc.save();
    zip.file(`page_${i + 1}.pdf`, singleBytes);
  }

  const zipContent = await zip.generateAsync({ type: 'blob' });
  return {
    blob: zipContent,
    filename: `${file.name.replace(/\.[^/.]+$/, '')}_pages.zip`
  };
}

/**
 * Rotate all pages in a PDF by 90 degrees clockwise.
 */
export async function rotatePDF(file, angle = 90) {
  const pdfDoc = await loadPdfSafely(file);
  const pages = pdfDoc.getPages();

  pages.forEach((page) => {
    const currentRotation = page.getRotation().angle;
    page.setRotation(degrees((currentRotation + angle) % 360));
  });

  const bytes = await pdfDoc.save();
  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    filename: `rotated_${file.name}`
  };
}

/**
 * Convert JPG/PNG Images into a single PDF.
 */
export async function imagesToPDF(imageFileList) {
  const pdfDoc = await PDFDocument.create();

  for (const imgFile of imageFileList) {
    const imgBytes = await imgFile.arrayBuffer();
    let embeddedImg;

    if (imgFile.type.includes('png')) {
      embeddedImg = await pdfDoc.embedPng(imgBytes);
    } else {
      embeddedImg = await pdfDoc.embedJpg(imgBytes);
    }

    if (embeddedImg) {
      const page = pdfDoc.addPage([embeddedImg.width, embeddedImg.height]);
      page.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: embeddedImg.width,
        height: embeddedImg.height,
      });
    }
  }

  const bytes = await pdfDoc.save();
  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    filename: 'converted_images.pdf'
  };
}

/**
 * Convert PDF pages to JPG image files.
 */
export async function pdfToJpg(file) {
  const pdf = await loadPdfJsSafely(file);
  const numPages = pdf.numPages;

  if (numPages === 1) {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;

    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.95));
    return {
      blob,
      filename: `${file.name.replace(/\.[^/.]+$/, '')}_page_1.jpg`
    };
  }

  const zip = new JSZip();
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;

    const pageBlob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.95));
    zip.file(`page_${i}.jpg`, pageBlob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return {
    blob: zipBlob,
    filename: `${file.name.replace(/\.[^/.]+$/, '')}_jpgs.zip`
  };
}

/**
 * Extract plain text and convert to Markdown.
 */
export async function pdfToMarkdown(file) {
  const pdf = await loadPdfJsSafely(file);
  let markdown = `# Extracted Content: ${file.name}\n\n`;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const textItems = textContent.items.map((item) => item.str).join(' ');

    markdown += `## Page ${i}\n\n${textItems}\n\n`;
  }

  return {
    blob: new Blob([markdown], { type: 'text/markdown;charset=utf-8' }),
    filename: `${file.name.replace(/\.[^/.]+$/, '')}.md`
  };
}