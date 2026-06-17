FROM --platform=linux/arm64 node:20-alpine

WORKDIR /app

RUN apk add --no-cache \
    openssl \
    libc6-compat \
    python3 \
    make \
    g++ \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Puppeteer: no descargar Chrome (es x86 y falla en ARM64). Usar el chromium
# nativo de Alpine instalado arriba.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 4000

CMD ["npm", "run", "dev"]
