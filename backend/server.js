const express = require('express');
const cors = require('cors');
const multer = require('multer');
const libre = require('libreoffice-convert');
const util = require('util');
const { spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

const libreConvert = util.promisify(libre.convert);
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

app.post('/api/convert/word-to-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    // Inspect buffer for OLE EncryptedPackage
    const buffer = req.file.buffer;
    const isOle = buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
    if (isOle) {
      const headerText = buffer.slice(0, 4096).toString('binary');
      if (headerText.includes('EncryptedPackage') || headerText.includes('EncryptionInfo')) {
        return res.status(400).json({
          error: `"${req.file.originalname}" is password-protected and cannot be converted.`,
          isLocked: true,
        });
      }
    }

    const pdfBuffer = await libreConvert(buffer, '.pdf', undefined);
    const originalName = req.file.originalname.replace(/\.[^/.]+$/, '');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Conversion failed:', error);
    return res.status(500).json({ error: 'Failed to convert document with LibreOffice.' });
  }
});

app.post('/api/convert/powerpoint-to-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const buffer = req.file.buffer;

    // Check for OLE EncryptedPackage header
    const isOle = buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
    if (isOle) {
      const headerText = buffer.slice(0, 4096).toString('binary');
      if (
        headerText.includes('EncryptedPackage') ||
        headerText.includes('EncryptionInfo') ||
        headerText.includes('PowerPoint Document')
      ) {
        return res.status(400).json({
          error: `"${req.file.originalname}" is password-protected and cannot be converted.`,
          isLocked: true,
        });
      }
    }

    const pdfBuffer = await libreConvert(buffer, '.pdf', undefined);
    const originalName = req.file.originalname.replace(/\.[^/.]+$/, '');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('PowerPoint conversion failed:', error);
    return res.status(500).json({ error: 'Failed to convert presentation with LibreOffice.' });
  }
});

app.post('/api/convert/html-to-pdf', upload.single('file'), async (req, res) => {
  try {
    let htmlBuffer;

    if (req.file) {
      htmlBuffer = req.file.buffer;
    } else if (req.body && req.body.html) {
      htmlBuffer = Buffer.from(req.body.html, 'utf-8');
    } else {
      return res.status(400).json({ error: 'No HTML file or content provided.' });
    }

    const pdfBuffer = await libreConvert(htmlBuffer, '.pdf', undefined);
    const originalName = req.file
      ? req.file.originalname.replace(/\.[^/.]+$/, '')
      : 'rendered_html';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('HTML conversion failed:', error);
    return res.status(500).json({ error: 'Failed to convert HTML to PDF with LibreOffice.' });
  }
});

// 4. Excel to PDF
app.post('/api/convert/excel-to-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const buffer = req.file.buffer;

    // Check for OLE EncryptedPackage header
    const isOle = buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
    if (isOle) {
      const headerText = buffer.slice(0, 4096).toString('binary');
      if (
        headerText.includes('EncryptedPackage') ||
        headerText.includes('EncryptionInfo') ||
        headerText.includes('Workbook')
      ) {
        return res.status(400).json({
          error: `"${req.file.originalname}" is password-protected and cannot be converted.`,
          isLocked: true,
        });
      }
    }

    const pdfBuffer = await libreConvert(buffer, '.pdf', undefined);
    const originalName = req.file.originalname.replace(/\.[^/.]+$/, '');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Excel conversion error:', error);
    return res.status(500).json({ error: 'Failed to convert Excel spreadsheet with LibreOffice.' });
  }
});

// Ghostscript PDF Compression Function
async function compressWithGhostscript(inputBuffer, qualityLevel = 45) {
  const tempId = `compress_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `${tempId}_in.pdf`);
  const outputPath = path.join(tempDir, `${tempId}_out.pdf`);

  await fs.writeFile(inputPath, inputBuffer);

  // Map compression percentage slider to Ghostscript PDF settings
  let pdfSetting = '/ebook'; // Balanced (150 DPI)
  if (qualityLevel <= 30) {
    pdfSetting = '/printer'; // High quality (300 DPI)
  } else if (qualityLevel >= 65) {
    pdfSetting = '/screen'; // Maximum compression (72 DPI)
  }

  const gsArgs = [
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.4',
    `-dPDFSETTINGS=${pdfSetting}`,
    '-dNOPAUSE',
    '-dQUIET',
    '-dBATCH',
    `-sOutputFile=${outputPath}`,
    inputPath,
  ];

  return new Promise((resolve, reject) => {
    const gs = spawn('gs', gsArgs);

    gs.on('close', async (code) => {
      try {
        if (code === 0) {
          const compressedBuffer = await fs.readFile(outputPath);
          resolve(compressedBuffer);
        } else {
          reject(new Error(`Ghostscript exited with code ${code}`));
        }
      } catch (err) {
        reject(err);
      } finally {
        // Cleanup temp files immediately
        await fs.unlink(inputPath).catch(() => {});
        await fs.unlink(outputPath).catch(() => {});
      }
    });

    gs.on('error', (err) => {
      reject(err);
    });
  });
}

// 5. Compress PDF Endpoint
app.post('/api/compress-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded.' });
    }

    const compressionPercent = parseInt(req.body.compressionPercent || '45', 10);
    const originalSize = req.file.buffer.length;

    const compressedBuffer = await compressWithGhostscript(req.file.buffer, compressionPercent);

    // Fallback if the file is already maximally compressed
    const finalBuffer = compressedBuffer.length < originalSize ? compressedBuffer : req.file.buffer;

    const originalName = req.file.originalname.replace(/\.[^/.]+$/, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="compressed_${originalName}.pdf"`);
    res.setHeader('x-original-size', originalSize.toString());
    res.setHeader('x-compressed-size', finalBuffer.length.toString());

    return res.send(finalBuffer);
  } catch (error) {
    console.error('Ghostscript compression error:', error);
    return res.status(500).json({ error: 'Failed to compress PDF.' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Conversion server running on port ${PORT}`);
});