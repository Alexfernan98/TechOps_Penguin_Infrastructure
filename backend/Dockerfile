FROM --platform=linux/arm64 node:20-alpine

WORKDIR /app

RUN apk add --no-cache \
    openssl \
    libc6-compat \
    python3 \
    make \
    g++

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 4000

CMD ["npm", "run", "dev"]
