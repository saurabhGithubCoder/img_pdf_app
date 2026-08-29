FROM node:20-slim

# Enable contrib/non-free repos to access TrueType packages
RUN sed -i 's/main$/main contrib non-free non-free-firmware/g' /etc/apt/sources.list.d/* 2>/dev/null || true

# Install system utilities, Python 3, LibreOffice suite, Ghostscript, and standard font sets
RUN apt-get update && apt-get install -y \
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
    fonts-freefont-ttf \
    ttf-mscorefonts-installer \
    fonts-dejavu \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install required Python packages for PDF, DOCX, and Excel processing
RUN pip3 install --no-cache-dir --break-system-packages pymupdf python-docx pdfplumber openpyxl pikepdf

WORKDIR /usr/src/app

# Install Node.js backend dependencies
COPY package*.json ./
RUN npm install --production

# Copy backend application code and conversion scripts
COPY . .

# Bind port for Render deployment (defaults to 5000)
ENV PORT=5000
EXPOSE 5000

CMD ["node", "server.js"]