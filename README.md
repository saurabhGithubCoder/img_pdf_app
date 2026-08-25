# it does not store files permanently on the disk.

Multer Configuration: multer.memoryStorage() keeps the incoming .docx file entirely in RAM as a temporary Node.js Buffer. No files are written to server folders or databases.

Conversion & Response: LibreOffice processes the in-memory stream, and Express immediately streams the output buffer back to the browser via res.send(pdfBuffer). Once the request finishes, the memory is released by Node.js garbage collection.

Client Handling: The browser converts the returned response into a temporary Blob URL in memory (URL.createObjectURL), which is revoked and cleared when the modal closes.

# LibreOffice is required on Render because libreoffice-convert acts as a wrapper around the system CLI (libreoffice --headless). Without the binary installed on the host OS, conversions will fail with spawn libreoffice ENOENT.

Because Render's default native Node runtime does not allow sudo apt-get install, the standard way to deploy this to Render is using a Dockerfile (Docker Web Service).

How to deploy on Render using Docker
Create a Dockerfile in your backend/ directory:

``
FROM node:20-slim

## libreoffice for local 
sudo apt-get update && sudo apt-get install -y libreoffice

## libreoffice ghost script for compression of pdf 
sudo apt-get update && sudo apt-get install -y ghostscript

# Install LibreOffice and minimal fonts for rendering
RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-writer \
    fonts-liberation \
    fonts-dejavu \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 5000
CMD ["node", "server.js"]
``

------ ghostscript -----
RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-writer \
    ghostscript \
    fonts-liberation \
    fonts-dejavu \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

## Steps to Deploy:
1. Frontend (Vite): Deploy your React app as a Static Site on Render. Set VITE_API_BASE_URL (or update your API fetch URL) to point to your live backend service URL instead of /api.

2. Backend: In Render, create a new Web Service, link your repository, set the Runtime to Docker, and point the root directory to your backend/ folder. Render will build the container with LibreOffice installed automatically.