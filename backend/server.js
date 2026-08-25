const express = require('express');
const cors = require('cors');
const multer = require('multer');
const libre = require('libreoffice-convert');
const util = require('util');

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Conversion server running on port ${PORT}`);
});