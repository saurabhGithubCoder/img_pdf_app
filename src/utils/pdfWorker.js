import { PDFDocument, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

//const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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
 * Genuine PDF compression using the backend Ghostscript optimization engine.
 * @param {File} file - Original PDF file
 * @param {number} compressionLevel - Target reduction slider (10 to 90)
 */
export async function compressPDF(file, compressionLevel = 45) {
  const isLocked = await checkPdfPassword(file);
  if (isLocked) {
    const err = new Error(`"${file.name}" is password-protected and cannot be processed.`);
    err.lockedFiles = [file.name];
    throw err;
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('compressionPercent', compressionLevel.toString());

  const response = await fetch('/api/compress-pdf', {
  //const response = await fetch(`${API_BASE_URL}/api/compress-pdf`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Server failed to compress PDF.');
  }

  const pdfBlob = await response.blob();
  const originalSizeHeader = response.headers.get('x-original-size');
  const compressedSizeHeader = response.headers.get('x-compressed-size');

  const origSize = originalSizeHeader ? parseInt(originalSizeHeader, 10) : file.size;
  const compSize = compressedSizeHeader ? parseInt(compressedSizeHeader, 10) : pdfBlob.size;

  return {
    blob: pdfBlob,
    filename: `compressed_${file.name}`,
    originalSize: origSize,
    compressedSize: compSize,
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
/*export async function rotatePDF(file, angle = 90) {
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
}*/

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

/**
 * Check if a Word (.docx / .doc) file is password-protected or encrypted.
 * @param {File} file - Word file object
 * @returns {Promise<boolean>}
 */
export async function checkDocxPassword(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // 1. Check for legacy OLE Compound Document signature (D0 CF 11 E0 A1 B1 1A E1)
    // Encrypted modern .docx files (Office OpenXML Agile Encryption) are wrapped in OLE packages
    const isOleContainer =
      bytes[0] === 0xd0 &&
      bytes[1] === 0xcf &&
      bytes[2] === 0x11 &&
      bytes[3] === 0xe0 &&
      bytes[4] === 0xa1 &&
      bytes[5] === 0xb1 &&
      bytes[6] === 0x1a &&
      bytes[7] === 0xe1;

    if (isOleContainer) {
      // Decode partial string header to check for standard encryption streams
      const headerText = new TextDecoder('latin1').decode(bytes.slice(0, 4096));
      if (
        headerText.includes('EncryptedPackage') ||
        headerText.includes('EncryptionInfo') ||
        headerText.includes('StrongEncryptionTransform')
      ) {
        return true;
      }
    }

    // 2. Inspect ZIP-based OpenXML container using JSZip
    try {
      const zip = await JSZip.loadAsync(arrayBuffer);

      // Check for Document Protection elements in settings.xml
      const settingsFile = zip.file('word/settings.xml');
      if (settingsFile) {
        const settingsXml = await settingsFile.async('text');
        if (
          settingsXml.includes('w:documentProtection') &&
          (settingsXml.includes('w:enforcement="1"') || settingsXml.includes('w:enforcement="true"'))
        ) {
          if (settingsXml.includes('w:cryptAlgorithmClass') || settingsXml.includes('w:hash')) {
            return true;
          }
        }
      }
    } catch {
      // If JSZip fails to read a modern .docx container, it is either corrupt or fully encrypted
      if (file.name.toLowerCase().endsWith('.docx')) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Convert DOCX / DOC to PDF using the LibreOffice backend service.
 * @param {File} file - Word document file
 */
export async function convertWordToPDF(file) {
  const isLocked = await checkDocxPassword(file);
  if (isLocked) {
    const err = new Error(`Cannot process: "${file.name}" is password-protected or encrypted.`);
    err.lockedFiles = [file.name];
    throw err;
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/convert/word-to-pdf', {
  //const response = await fetch(`${API_BASE_URL}/api/convert/word-to-pdf`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (errorData.isLocked) {
      const err = new Error(`Cannot process: "${file.name}" is password-protected.`);
      err.lockedFiles = [file.name];
      throw err;
    }
    throw new Error(errorData.error || 'Server failed to convert Word document.');
  }

  const pdfBlob = await response.blob();
  const baseName = file.name.replace(/\.[^/.]+$/, '');

  return {
    blob: pdfBlob,
    filename: `${baseName}.pdf`,
    originalSize: file.size,
    compressedSize: pdfBlob.size,
  };
}

/**
 * Check if a PowerPoint (.pptx / .ppt) file is password-protected or encrypted.
 * @param {File} file - Presentation file object
 * @returns {Promise<boolean>}
 */
export async function checkPptxPassword(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // 1. Check for legacy OLE Compound Document signature (Encrypted modern .pptx files are wrapped in OLE packages)
    const isOleContainer =
      bytes[0] === 0xd0 &&
      bytes[1] === 0xcf &&
      bytes[2] === 0x11 &&
      bytes[3] === 0xe0 &&
      bytes[4] === 0xa1 &&
      bytes[5] === 0xb1 &&
      bytes[6] === 0x1a &&
      bytes[7] === 0xe1;

    if (isOleContainer) {
      const headerText = new TextDecoder('latin1').decode(bytes.slice(0, 4096));
      if (
        headerText.includes('EncryptedPackage') ||
        headerText.includes('EncryptionInfo') ||
        headerText.includes('StrongEncryptionTransform')
      ) {
        return true;
      }
    }

    // 2. Inspect ZIP-based OpenXML container using JSZip
    try {
      const zip = await JSZip.loadAsync(arrayBuffer);

      // Check presentation-level protection settings
      const presPropsFile = zip.file('ppt/presProps.xml');
      if (presPropsFile) {
        const presPropsXml = await presPropsFile.async('text');
        if (
          presPropsXml.includes('p:modifyVerifier') ||
          presPropsXml.includes('p:cryptAlgorithmClass') ||
          presPropsXml.includes('password=')
        ) {
          return true;
        }
      }
    } catch {
      // If JSZip fails to read a modern .pptx container, it is either corrupt or password-protected
      if (file.name.toLowerCase().endsWith('.pptx')) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Convert PPTX / PPT to PDF using the LibreOffice backend service.
 * @param {File} file - Presentation document file
 */
export async function convertPowerpointToPDF(file) {
  const isLocked = await checkPptxPassword(file);
  if (isLocked) {
    const err = new Error(`Cannot process: "${file.name}" is password-protected or encrypted.`);
    err.lockedFiles = [file.name];
    throw err;
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/convert/powerpoint-to-pdf', {
  //const response = await fetch(`${API_BASE_URL}/api/convert/powerpoint-to-pdf`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (errorData.isLocked) {
      const err = new Error(`Cannot process: "${file.name}" is password-protected.`);
      err.lockedFiles = [file.name];
      throw err;
    }
    throw new Error(errorData.error || 'Server failed to convert presentation.');
  }

  const pdfBlob = await response.blob();
  const baseName = file.name.replace(/\.[^/.]+$/, '');

  return {
    blob: pdfBlob,
    filename: `${baseName}.pdf`,
    originalSize: file.size,
    compressedSize: pdfBlob.size,
  };
}

/**
 * Convert HTML file or HTML string to PDF using LibreOffice.
 * @param {File|string} input - HTML File object or raw HTML string
 */
export async function convertHtmlToPDF(input) {
  let response;

  if (typeof input === 'string') {
    response = await fetch('/api/convert/html-to-pdf', {
    //response = await fetch(`${API_BASE_URL}/api/convert/html-to-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: input }),
    });
  } else {
    const formData = new FormData();
    formData.append('file', input);

    response = await fetch('/api/convert/html-to-pdf', {
    //response = await fetch(`${API_BASE_URL}/api/convert/html-to-pdf`, {
      method: 'POST',
      body: formData,
    });
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Server failed to convert HTML to PDF.');
  }

  const pdfBlob = await response.blob();
  const baseName = typeof input === 'string' ? 'document' : input.name.replace(/\.[^/.]+$/, '');

  return {
    blob: pdfBlob,
    filename: `${baseName}.pdf`,
    originalSize: typeof input === 'string' ? new Blob([input]).size : input.size,
    compressedSize: pdfBlob.size,
  };
}

/**
 * Check if an Excel (.xlsx / .xls) file is password-protected or encrypted.
 * @param {File} file - Excel file object
 * @returns {Promise<boolean>}
 */
export async function checkExcelPassword(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // 1. Check for legacy OLE Compound Document signature (Encrypted modern .xlsx files are wrapped in OLE packages)
    const isOleContainer =
      bytes[0] === 0xd0 &&
      bytes[1] === 0xcf &&
      bytes[2] === 0x11 &&
      bytes[3] === 0xe0 &&
      bytes[4] === 0xa1 &&
      bytes[5] === 0xb1 &&
      bytes[6] === 0x1a &&
      bytes[7] === 0xe1;

    if (isOleContainer) {
      const headerText = new TextDecoder('latin1').decode(bytes.slice(0, 4096));
      if (
        headerText.includes('EncryptedPackage') ||
        headerText.includes('EncryptionInfo') ||
        headerText.includes('StrongEncryptionTransform')
      ) {
        return true;
      }
    }

    // 2. Inspect ZIP-based OpenXML container using JSZip
    try {
      const zip = await JSZip.loadAsync(arrayBuffer);

      // Check workbook-level protection in xl/workbook.xml
      const workbookFile = zip.file('xl/workbook.xml');
      if (workbookFile) {
        const wbXml = await workbookFile.async('text');
        if (wbXml.includes('workbookProtection') && (wbXml.includes('workbookPassword') || wbXml.includes('lockStructure="1"'))) {
          return true;
        }
      }
    } catch {
      // If JSZip fails to parse a modern .xlsx container, it is either corrupt or password-protected
      if (file.name.toLowerCase().endsWith('.xlsx')) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Convert XLSX / XLS to PDF using the LibreOffice backend service.
 * @param {File} file - Excel spreadsheet file
 */
export async function convertExcelToPDF(file) {
  const isLocked = await checkExcelPassword(file);
  if (isLocked) {
    const err = new Error(`Cannot process: "${file.name}" is password-protected or encrypted.`);
    err.lockedFiles = [file.name];
    throw err;
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/convert/excel-to-pdf', {
  //const response = await fetch(`${API_BASE_URL}/api/convert/excel-to-pdf`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (errorData.isLocked) {
      const err = new Error(`Cannot process: "${file.name}" is password-protected.`);
      err.lockedFiles = [file.name];
      throw err;
    }
    throw new Error(errorData.error || 'Server failed to convert Excel document.');
  }

  const pdfBlob = await response.blob();
  const baseName = file.name.replace(/\.[^/.]+$/, '');

  return {
    blob: pdfBlob,
    filename: `${baseName}.pdf`,
    originalSize: file.size,
    compressedSize: pdfBlob.size,
  };
}

/**
 * Rotate PDF pages.
 * Supports both a single global angle or an array of page items with custom rotation per page.
 * @param {File} file - PDF file
 * @param {number|Array} options - Global rotation angle (e.g. 90) OR Array of page items [{ pageNumber, rotation }]
 */
export async function rotatePDF(file, options = 90) {
  const isLocked = await checkPdfPassword(file);
  if (isLocked) {
    const err = new Error(`"${file.name}" is password-protected and cannot be processed.`);
    err.lockedFiles = [file.name];
    throw err;
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  if (Array.isArray(options)) {
    // Apply per-page custom rotation
    options.forEach((item, index) => {
      if (pages[index] && item.rotation !== 0) {
        const currentRotation = pages[index].getRotation().angle;
        pages[index].setRotation(degrees((currentRotation + item.rotation) % 360));
      }
    });
  } else {
    // Apply global uniform angle across all pages
    const angle = typeof options === 'number' ? options : 90;
    pages.forEach((page) => {
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees((currentRotation + angle) % 360));
    });
  }

  const bytes = await pdfDoc.save({ useObjectStreams: true });
  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    filename: `rotated_${file.name}`,
  };
}

/**
 * Convert PDF to editable Word document (.docx) using the backend service.
 * @param {File} file - PDF document file
 */
export async function convertPdfToWord(file) {
  const isLocked = await checkPdfPassword(file);
  if (isLocked) {
    const err = new Error(`Cannot process: "${file.name}" is password-protected.`);
    err.lockedFiles = [file.name];
    throw err;
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/convert/pdf-to-word', {
  //const response = await fetch(`${API_BASE_URL}/api/convert/pdf-to-word`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Server failed to convert PDF to Word document.');
  }

  const docxBlob = await response.blob();
  const baseName = file.name.replace(/\.[^/.]+$/, '');

  return {
    blob: docxBlob,
    filename: `${baseName}.docx`,
    originalSize: file.size,
    compressedSize: docxBlob.size,
  };
}

/**
 * Convert PDF to PowerPoint presentation (.pptx) using the backend service.
 * @param {File} file - PDF document file
 */
export async function convertPdfToPowerpoint(file) {
  const isLocked = await checkPdfPassword(file);
  if (isLocked) {
    const err = new Error(`Cannot process: "${file.name}" is password-protected.`);
    err.lockedFiles = [file.name];
    throw err;
  }

  const formData = new FormData();
  formData.append('file', file);
  
  //const response = await fetch(`${API_BASE_URL}/api/convert/pdf-to-powerpoint`, {
  const response = await fetch('/api/convert/pdf-to-powerpoint', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Server failed to convert PDF to PowerPoint presentation.');
  }

  const pptxBlob = await response.blob();
  const baseName = file.name.replace(/\.[^/.]+$/, '');

  return {
    blob: pptxBlob,
    filename: `${baseName}.pptx`,
    originalSize: file.size,
    compressedSize: pptxBlob.size,
  };
}

/**
 * Convert PDF to Excel spreadsheet (.xlsx) using the backend service.
 * @param {File} file - PDF document file
 */
export async function convertPdfToExcel(file) {
  const isLocked = await checkPdfPassword(file);
  if (isLocked) {
    const err = new Error(`Cannot process: "${file.name}" is password-protected.`);
    err.lockedFiles = [file.name];
    throw err;
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/convert/pdf-to-excel', {
  //const response = await fetch(`${API_BASE_URL}/api/convert/pdf-to-excel`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Server failed to convert PDF to Excel spreadsheet.');
  }

  const xlsxBlob = await response.blob();
  const baseName = file.name.replace(/\.[^/.]+$/, '');

  return {
    blob: xlsxBlob,
    filename: `${baseName}.xlsx`,
    originalSize: file.size,
    compressedSize: xlsxBlob.size,
  };
}

import { rgb, StandardFonts } from 'pdf-lib';

/**
 * Add customizable page numbers to a PDF document.
 * @param {File} file - Source PDF file
 * @param {Object} options - Numbering layout options
 */
export async function addPageNumbersToPDF(file, options) {
  const isLocked = await checkPdfPassword(file);
  if (isLocked) {
    const err = new Error(`Cannot process: "${file.name}" is password-protected or encrypted.`);
    err.lockedFiles = [file.name];
    throw err;
  }

  const {
    position = 'bottom-right',
    margin = 'recommended',
    pageMode = 'single',
    firstNumber = 1,
    fromPage = 1,
    toPage = 1,
    textPreset = 'number-only',
    customText = 'Page {n} of {p}',
    fontSize = 10,
    fontFamily = 'Helvetica',
    isBold = false,
    isItalic = false,
    isUnderline = false,
    color = '#4A5568',
  } = options;

  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();

  // Load standard font styles
  let fontRef;
  if (fontFamily === 'Times') {
    if (isBold && isItalic) fontRef = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
    else if (isBold) fontRef = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    else if (isItalic) fontRef = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    else fontRef = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  } else if (fontFamily === 'Courier') {
    if (isBold && isItalic) fontRef = await pdfDoc.embedFont(StandardFonts.CourierBoldOblique);
    else if (isBold) fontRef = await pdfDoc.embedFont(StandardFonts.CourierBold);
    else if (isItalic) fontRef = await pdfDoc.embedFont(StandardFonts.CourierOblique);
    else fontRef = await pdfDoc.embedFont(StandardFonts.Courier);
  } else {
    if (isBold && isItalic) fontRef = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
    else if (isBold) fontRef = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    else if (isItalic) fontRef = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    else fontRef = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  // Margin in points (72 points = 1 inch)
  let marginPt = 36; // recommended (~0.5 in)
  if (margin === 'small') marginPt = 20;
  if (margin === 'large') marginPt = 54;

  // Parse RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255 || 0.2;
  const g = parseInt(hex.substring(2, 4), 16) / 255 || 0.2;
  const b = parseInt(hex.substring(4, 6), 16) / 255 || 0.2;
  const textColor = rgb(r, g, b);

  const startPage = Math.max(1, Math.min(fromPage, totalPages));
  const endPage = Math.min(totalPages, Math.max(startPage, toPage));

  for (let i = startPage - 1; i <= endPage - 1; i++) {
    const page = pdfDoc.getPage(i);
    const { width, height } = page.getSize();
    const currentNumber = firstNumber + (i - (startPage - 1));

    // Construct text string
    let label = `${currentNumber}`;
    if (textPreset === 'page-n') {
      label = `Page ${currentNumber}`;
    } else if (textPreset === 'page-n-of-p') {
      label = `Page ${currentNumber} of ${totalPages}`;
    } else if (textPreset === 'custom') {
      label = customText
        .replace(/{n}/g, `${currentNumber}`)
        .replace(/{p}/g, `${totalPages}`);
    }

    const textWidth = fontRef.widthOfTextAtSize(label, fontSize);
    const textHeight = fontRef.heightAtSize(fontSize);

    // Resolve active horizontal / vertical alignments
    let activePos = position;
    if (pageMode === 'facing') {
      const isEven = (i + 1) % 2 === 0;
      if (position.includes('right') && isEven) {
        activePos = position.replace('right', 'left');
      } else if (position.includes('left') && isEven) {
        activePos = position.replace('left', 'right');
      }
    }

    let x = marginPt;
    let y = marginPt;

    // Horizontal coordinates
    if (activePos.includes('left')) {
      x = marginPt;
    } else if (activePos.includes('center')) {
      x = (width - textWidth) / 2;
    } else if (activePos.includes('right')) {
      x = width - marginPt - textWidth;
    }

    // Vertical coordinates
    if (activePos.startsWith('top')) {
      y = height - marginPt - textHeight;
    } else if (activePos.startsWith('middle')) {
      y = (height - textHeight) / 2;
    } else if (activePos.startsWith('bottom')) {
      y = marginPt;
    }

    page.drawText(label, {
      x,
      y,
      size: fontSize,
      font: fontRef,
      color: textColor,
    });

    if (isUnderline) {
      page.drawLine({
        start: { x, y: y - 2 },
        end: { x: x + textWidth, y: y - 2 },
        thickness: 0.8,
        color: textColor,
      });
    }
  }

  const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
  return {
    blob: new Blob([pdfBytes], { type: 'application/pdf' }),
    filename: `numbered_${file.name}`,
    originalSize: file.size,
    compressedSize: pdfBytes.byteLength,
  };
}