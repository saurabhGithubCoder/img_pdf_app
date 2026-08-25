FROM node:20-slim

# Install system dependencies: LibreOffice, Ghostscript, Python3, and fonts
RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    ghostscript \
    fonts-liberation \
    fonts-dejavu \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --production

COPY . .

ENV PORT=5000
EXPOSE 5000

CMD ["node", "server.js"]