FROM node:20-slim

# Install system dependencies, bzip2, build tools, Python, LibreOffice, and Ghostscript
RUN apt-get update && apt-get install -y \
    bzip2 \
    tar \
    curl \
    build-essential \
    python3 \
    python3-pip \
    libreoffice \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    ghostscript \
    fonts-liberation \
    fonts-dejavu \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install pdf2docx
RUN pip3 install --no-cache-dir --break-system-packages pdf2docx

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --production

COPY . .

ENV PORT=5000
EXPOSE 5000

CMD ["node", "server.js"]