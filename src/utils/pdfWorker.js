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
 * Genuine client-side PDF compression.
 * Scales document raster DPI and recompresses image streams to achieve actual size reduction.
 * * @param {File} file - Original PDF file
 * @param {number} compressionLevel - Target reduction slider (10 to 90)
 */
export async function compressPDF(file, compressionLevel = 45) {
  const isLocked = await checkPdfPassword(file);
  if (isLocked) {
    const err = new Error(`"${file.name}" is password-protected and cannot be processed.`);
    err.lockedFiles = [file.name];
    throw err;
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdfjsDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
  const numPages = pdfjsDoc.numPages;

  // Map compression slider percentage to rendering scale & quality
  // Standard A4 is 595 x 842 points. 
  // Scale 1.0 = ~72 DPI (Standard Web/Doc quality)
  // Scale 1.25 = ~90 DPI (Crisp Text)
  // Scale 0.85 = ~60 DPI (Maximum Compression)
  const ratio = Math.min(Math.max(compressionLevel / 100, 0.1), 0.9);
  
  // Dynamic scale factor: from 1.25 (at 10%) down to 0.75 (at 90%)
  const renderScale = 1.30 - (ratio * 0.55);
  
  // Dynamic JPEG quality: from 0.80 (at 10%) down to 0.30 (at 90%)
  const jpegQuality = 0.82 - (ratio * 0.52);

  const compressedPdf = await PDFDocument.create();

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfjsDoc.getPage(pageNum);
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const targetViewport = page.getViewport({ scale: renderScale });

    // Render page to an offscreen Canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
    canvas.width = Math.floor(targetViewport.width);
    canvas.height = Math.floor(targetViewport.height);

    // Apply crisp solid white backdrop
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport: targetViewport,
      intent: 'display'
    }).promise;

    // Encode rendered frame as compressed JPEG buffer
    const jpegDataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
    const jpegBuffer = await fetch(jpegDataUrl).then((r) => r.arrayBuffer());

    // Embed compressed frame into the output PDF
    const embeddedImg = await compressedPdf.embedJpg(jpegBuffer);
    
    // Add page preserving exact original physical dimensions
    const newPage = compressedPdf.addPage([unscaledViewport.width, unscaledViewport.height]);
    newPage.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: unscaledViewport.width,
      height: unscaledViewport.height,
    });
  }

  // Strip metadata & save with object stream compression
  const compressedBytes = await compressedPdf.save({
    useObjectStreams: true,
    addDefaultPage: false
  });

  const outputBlob = new Blob([compressedBytes], { type: 'application/pdf' });

  return {
    blob: outputBlob,
    filename: `compressed_${file.name}`,
    originalSize: file.size,
    compressedSize: outputBlob.size,
  };
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
    const viewport = page.getViewport({ scale: 0.35 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: ctx, viewport }).promise;
    thumbnails.push({
      id: `page-${i}-${Date.now()}-${Math.random()}`,
      originalIndex: i - 1,
      pageNumber: i,
      rotation: 0,
      dataUrl: canvas.toDataURL('image/jpeg', 0.8)
    });
  }

  return { totalPages: numPages, thumbnails };
}

/**
 * Reorganize PDF: Apply reordering and page rotations
 */
export async function reorganizePDF(file, pageItems) {
  const isLocked = await checkPdfPassword(file);
  if (isLocked) {
    const err = new Error(`"${file.name}" is password-protected and cannot be processed.`);
    err.lockedFiles = [file.name];
    throw err;
  }

  if (!pageItems || pageItems.length === 0) {
    throw new Error('At least one page must remain in the document.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const originalPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const newPdf = await PDFDocument.create();

  const indices = pageItems.map((item) => item.originalIndex);
  const copiedPages = await newPdf.copyPages(originalPdf, indices);

  copiedPages.forEach((page, i) => {
    const customRotation = pageItems[i].rotation || 0;
    if (customRotation !== 0) {
      const currentRot = page.getRotation().angle;
      page.setRotation(degrees((currentRot + customRotation) % 360));
    }
    newPdf.addPage(page);
  });

  const bytes = await newPdf.save();
  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    filename: `organized_${file.name}`
  };
}

/**
 * Extract specific page indices (1-based) into a new PDF.
 */
export async function extractPagesFromPDF(file, pagesToExtractSet) {
  const isLocked = await checkPdfPassword(file);
  if (isLocked) {
    const err = new Error(`"${file.name}" is password-protected and cannot be processed.`);
    err.lockedFiles = [file.name];
    throw err;
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();

  if (pagesToExtractSet.size === 0) {
    throw new Error('Please select at least one page to extract.');
  }

  const newPdf = await PDFDocument.create();
  const sortedPages = Array.from(pagesToExtractSet)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b)
    .map((p) => p - 1);

  const copiedPages = await newPdf.copyPages(pdfDoc, sortedPages);
  copiedPages.forEach((page) => newPdf.addPage(page));

  const bytes = await newPdf.save();
  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    filename: `extracted_${file.name}`
  };
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
/**
 * Convert an ordered list of Image files or image items into a single PDF.
 * @param {Array} imageItems - Array of image file objects or objects with { file, rotation }
 */
export async function imagesToPDF(imageItems) {
  const pdfDoc = await PDFDocument.create();

  for (const item of imageItems) {
    const file = item.file || item;
    const customRotation = item.rotation || 0;
    const imgBytes = await file.arrayBuffer();
    let embeddedImg;

    if (file.type.includes('png') || file.name.endsWith('.png')) {
      embeddedImg = await pdfDoc.embedPng(imgBytes);
    } else {
      embeddedImg = await pdfDoc.embedJpg(imgBytes);
    }

    if (embeddedImg) {
      const page = pdfDoc.addPage([embeddedImg.width, embeddedImg.height]);
      
      if (customRotation !== 0) {
        page.setRotation(degrees(customRotation));
      }

      page.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: embeddedImg.width,
        height: embeddedImg.height,
      });
    }
  }

  const bytes = await pdfDoc.save({ useObjectStreams: true });
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