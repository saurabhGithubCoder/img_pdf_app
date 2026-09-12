# 📄 PDF Forge
A modern, high-performance web application and desktop suite for converting, manipulating, compressing, and organizing PDF documents and Office files. Built with a React + Vite frontend and Node, Express + Python backend engine.

---

## 🚀 Key Features & tools

### Organize PDF - 
* **Merge PDF** : Combine multiple PDFs
* **Split PDF** : Split documents by custom page ranges.
* **Remove Pages** : Remove pages just by selecting or defining the range
* **Extract Pages** : Extract specific page or range of pages from a PDF 
* **Organize PDF** : Drag-and-drop page reordering with individual page rotation.
* **Scan to PDF** : Directly scan a page from your phone to capture and convert it into PDF

### Convert to PDF 
* **Compress PDF** : Quality-preserving compression with before-and-after file size metrics.
* **Repair PDF** :
* **OCR Pages** :

### Optimize PDF 
* **JPG to PDF** : Conversion of Images to PDF with additional configuration applied on image while conversion
* **Word to PDF** : Direct conversion of Word (`.docx`, `.doc`) to PDF 
* **PowerPoint to PDF** : Direct conversion of PowerPoint (`.pptx`, `.ppt`) to PDF
* **Excel to PDF** : Direct conversion of Excel (`.xlsx`, `.xls`)
* **HTML to PDF** : Direct conversion of HTML (`.html`) files to PDF

### Convert from PDF 
* **PDF to JPG** : Conversion PDF file to image view of each page
* **PDF to Word** : High-fidelity document reconstruction preserving fonts, sizes, tables, and alignment without OpenXML schema corruption.
* **PDF to PowerPoint** : Slide-by-slide conversion retaining layout boundaries.
* **PDF to Excel** : Structured table and data extraction directly into clean `.xlsx` workbooks.
* **PDF to PDF/A** :

### Edit PDF 
* **Rotate PDF** : Interactive single-page and full-document rotation ($90^\circ$, $-90^\circ$, $180^\circ$).
* **Add page numbers** : Add pages on each / specific / range of pages with extra configuration tools given 
* **Add watermark** : Adding watermark with rotational ability on each or range of pages
* **Crop PDF** : 
* **Edit PDF** :
* **PDF Forms** :

### PDF Security 
* **Unlock PDF** : Unlock a password protect or encrypted PDF once and for all 
* **Protect PDF** : Protect your PDF with password you want 
* **Sign PDF** : Sign with uploaded or signed signature, company stamp or name & date 
* **Redact PDF** :
* **Compare PDF** :

### PDF Intelligence 
* **AI Summarizer** : Summarize your PDF with AI tool without going through a long set of pages
* **Translate PDF** : Translate a PDF from one to other language 
* **PDF to markdown** : Convert PDF content to markdown extension 

---

## 🛠 Tech Stack

* **Frontend:** React 18, Vite, Tailwind CSS, Lucide React, PDF-Lib, PDF.js
* **Backend:** Node.js, Express, Multer, Child Process CLI Orchestration
* **Engines & Parsers:** Python 3 (`PyMuPDF`, `python-docx`, `pdfplumber`, `openpyxl`), LibreOffice (Headless), Ghostscript, Poppler-Utils

**NOTE**: LibreOffice is required on Render because libreoffice-convert acts as a wrapper around the system CLI (libreoffice --headless). Without the binary installed on the host OS, conversions will fail with spawn libreoffice ENOENT.

---

### Does PDF Forge store files on server or database ?
**No, this app does not store your processed or uploaded file anywhere.** Most of the tools process files on your browser, and those processed on backend/server, does not store. Also, we do not have database usage. We have open sourced this app as a proof. 
  * **Multer Configuration**: multer.memoryStorage() keeps the incoming .docx file entirely in RAM as a temporary Node.js Buffer. No files are written to server folders or databases.
  * **Conversion & Response**: LibreOffice processes the in-memory stream, and Express immediately streams the output buffer back to the browser via res.send(pdfBuffer). Once the request finishes, the memory is released by Node.js garbage collection.
  * **Client Handling**: The browser converts the returned response into a temporary Blob URL in memory (URL.createObjectURL), which is revoked and cleared when the modal closes.

---

## 📂 Repository Structure

```text
├── backend/
│   ├── convert_pdf2docx.py      # Python engine for PDF/DOC to DOCX reconstruction
│   ├── convert_pdf2excel.py     # Python engine for PDF to XLSX table extraction
│   ├── Dockerfile               # Container deployment configuration for backend
│   ├── package.json             # Backend dependencies
│   └── server.js                # Express API endpoints & file conversion pipeline
├── src/
│   ├── components/
|   |   ├── Footer.jsx           # Footer of app
|   |   ├── Header.jsx           # header of app
|   |   ├── Reviews.jsx          # Reviews Carousel of app 
│   │   ├── ToolCard.jsx         # Tool card UI component
|   |   ├── ToolStudio.jsx       # Tool Studio component of app 
│   │   └── ToolModal.jsx        # Interactive modal & page workspace
|   ├── data/
|   │   └── pdfTools.jsx         # all pdf tools entry
│   ├── utils/
│   │   └── pdfWorker.js         # Client-side processing & backend API client
│   ├── App.jsx                  # Main dashboard layout
│   ├── index.css                # Global Tailwind CSS styles
│   └── main.jsx                 # Application entry point
├── .env.production              # Production API base URL configuration
├── index.html                   # HTML entry page
├── package.json                 # Frontend dependencies & deployment scripts
├── tailwind.config.js           # Tailwind CSS configuration
└── vite.config.js               # Vite build configuration

```

## 💻 Local Setup & Installation

### Prerequisites
Ensure you have the following installed on your machine:

  1. Node.js: v18+ or v20+
  2. Python: 3.10+ with pip
  3. System Packages (Linux / Debian / Codespaces):

```
sudo apt-get update && sudo apt-get install -y \
  bzip2 \
  tar \
  curl \
  wget \
  cabextract \
  build-essential \
  python3 \
  python3-pip \
  libreoffice \
  libreoffice-writer \
  libreoffice-calc \
  libreoffice-impress \
  ghostscript \
  qpdf \
  poppler-utils \
  fonts-liberation \
  fonts-liberation2 \
  fonts-dejavu \
  fonts-croscore \
  fonts-crosextra-carlito \
  fonts-crosextra-caladea \
  fonts-noto \
  fonts-freefont-ttf
```

### 1. Backend setup
```
# Navigate to the backend directory
cd backend

# Install Node dependencies
npm install

# Install required Python layout and parsing libraries
pip3 install --break-system-packages pymupdf python-docx pdfplumber openpyxl pikepdf

# Start the backend server (runs on http://localhost:5000)
node server.js
```

### 2. Frontend setup
```
# Navigate to the project root
cd ..

# Install frontend dependencies
npm install

# Start the Vite development server (runs on http://localhost:5173)
npm run dev
```

## 🐳 Docker Deployment (Render / Cloud Containers)
Build and run the self-contained backend container:
```
# Build the backend container image
docker build -t pdf-tools-backend ./backend

# Run the container exposing port 5000
docker run -p 5000:5000 pdf-tools-backend
```

## 🌐 Production Hosting Setup

**Backend (Render):** In Render, create a new Web Service, link your repository, set the Runtime to Docker, and point the root directory to your backend/ folder. Render will build the container with LibreOffice installed automatically. Render binds to port 5000 automatically.

***Frontend (GitHub Pages / Vercel):** Set VITE_API_BASE_URL=https://<your-backend-domain>.onrender.com in .env.production and deploy using npm run build.

## 🔒 Security & Processing Architecture

* Stateless & Ephemeral Storage: All uploaded and generated files are stored in temporary memory/disk locations and deleted immediately after the response stream closes.

* Password Verification: Encrypted files are validated prior to execution to prevent process deadlocks.

* Valid OpenXML Generation: Document models are synthesized strictly within Microsoft OpenXML standards to eliminate corrupt file warnings.
