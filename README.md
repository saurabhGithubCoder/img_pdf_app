# 📄 PDF & Office Tool Suite

A modern, high-performance web application and desktop suite for converting, manipulating, compressing, and organizing PDF documents and Office files. Built with a React + Vite frontend and an Express + Python backend engine.

---

## 🚀 Key Features

* **PDF to Word (.docx / .doc):** High-fidelity document reconstruction preserving fonts, sizes, tables, and alignment without OpenXML schema corruption.
* **PDF to PowerPoint (.pptx):** Slide-by-slide conversion retaining layout boundaries.
* **PDF to Excel (.xlsx):** Structured table and data extraction directly into clean `.xlsx` workbooks.
* **Office to PDF:** Direct conversion of Word (`.docx`, `.doc`), PowerPoint (`.pptx`, `.ppt`), Excel (`.xlsx`, `.xls`), and HTML (`.html`) files to PDF.
* **Interactive PDF Tools:**
  * **Visual Page Organizer:** Drag-and-drop page reordering with individual page rotation.
  * **Batch Rotate:** Interactive single-page and full-document rotation ($90^\circ$, $-90^\circ$, $180^\circ$).
  * **Split & Merge:** Combine multiple PDFs or split documents by custom page ranges.
  * **Remove & Extract Pages:** Visual page grid selector to delete or isolate specific pages.
  * **Images to PDF & PDF to JPG:** Convert image collections (JPG, PNG, WebP) to PDF or extract PDF pages as images.
  * **Smart PDF Compression:** Quality-preserving compression with before-and-after file size metrics.

---

## 🛠 Tech Stack

* **Frontend:** React 18, Vite, Tailwind CSS, Lucide React, PDF-Lib, PDF.js
* **Backend:** Node.js, Express, Multer, Child Process CLI Orchestration
* **Engines & Parsers:** Python 3 (`PyMuPDF`, `python-docx`, `pdfplumber`, `openpyxl`), LibreOffice (Headless), Ghostscript, Poppler-Utils

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
|   |   ├── Header.jsx           # header of app 
│   │   ├── ToolCard.jsx         # Tool card UI component
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

💻 Local Setup & Installation
Prerequisites
Ensure you have the following installed on your machine:

1. Node.js: v18+ or v20+

2. Python: 3.10+ with pip

3. System Packages (Linux / Debian / Codespaces):

```
sudo apt-get update && sudo apt-get install -y \
    libreoffice \
    ghostscript \
    poppler-utils \
    bzip2 \
    tar \
    build-essential
```

1. Backend setup
```
# Navigate to the backend directory
cd backend

# Install Node dependencies
npm install

# Install required Python layout and parsing libraries
pip3 install --upgrade pymupdf python-docx pdfplumber openpyxl

# Start the backend server (runs on http://localhost:5000)
node server.js
```

2. Frontend setup
```
# Navigate to the project root
cd ..

# Install frontend dependencies
npm install

# Start the Vite development server (runs on http://localhost:5173)
npm run dev
```
🐳 Docker Deployment (Render / Cloud Containers)
Build and run the self-contained backend container:
```
# Build the backend container image
docker build -t pdf-tools-backend ./backend

# Run the container exposing port 5000
docker run -p 5000:5000 pdf-tools-backend
```

🌐 Production Hosting Setup
Backend (Render): Deploy the backend/ directory as a Docker Web Service. Render binds to port 5000 automatically.

Frontend (GitHub Pages / Vercel): Set VITE_API_BASE_URL=https://<your-backend-domain>.onrender.com in .env.production and deploy using npm run build.

🔒 Security & Processing Architecture
Stateless & Ephemeral Storage: All uploaded and generated files are stored in temporary memory/disk locations and deleted immediately after the response stream closes.

Password Verification: Encrypted files are validated prior to execution to prevent process deadlocks.

Valid OpenXML Generation: Document models are synthesized strictly within Microsoft OpenXML standards to eliminate corrupt file warnings.
