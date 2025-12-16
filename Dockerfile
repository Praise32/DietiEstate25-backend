# STAGE 1: Build
# Usiamo node:20-slim invece di alpine per compatibilità e stabilità di rete
FROM node:20-slim AS builder

WORKDIR /app

# Copia i file di configurazione
COPY package*.json ./
COPY tsconfig.json ./

# Installa tutte le dipendenze
RUN npm install

# Copia il codice sorgente
COPY . .

# Compila il TypeScript
RUN npm run build

# STAGE 2: Production Runner
FROM node:20-slim

WORKDIR /app

# Copia solo package.json per installare le dipendenze di produzione
COPY package*.json ./

# Installa SOLO le dipendenze necessarie per eseguire
RUN npm install --production

# Copia la build compilata dallo stage precedente
COPY --from=builder /app/dist ./dist

# Espone la porta
EXPOSE 5003

# Comando di avvio
CMD ["npm", "start"]