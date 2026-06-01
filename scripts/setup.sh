#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# TechOpsHub — Setup inicial
# Ejecutar UNA SOLA VEZ después de clonar el repo
# Uso: chmod +x scripts/setup.sh && ./scripts/setup.sh
# ═══════════════════════════════════════════════════════════════

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════╗"
echo "║   TechOpsHub — Setup Fase 0           ║"
echo "║   Penguin Infrastructure S.A.         ║"
echo "╚═══════════════════════════════════════╝"
echo -e "${NC}"

# ─────────────────────────────────────────────
# 1. Verificar prerequisitos
# ─────────────────────────────────────────────
echo -e "${CYAN}[1/5] Verificando prerequisitos...${NC}"

if ! command -v docker &> /dev/null; then
  echo -e "${RED}✗ Docker no está instalado. Instalar Docker Desktop para Mac.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Docker disponible$(NC)"

if ! command -v node &> /dev/null; then
  echo -e "${YELLOW}⚠ Node.js no encontrado localmente (se usa el del contenedor)${NC}"
else
  NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${YELLOW}⚠ Node.js $NODE_VERSION detectado — se recomienda Node 20+${NC}"
  else
    echo -e "${GREEN}✓ Node.js $(node -v) disponible${NC}"
  fi
fi

# ─────────────────────────────────────────────
# 2. Crear archivo .env
# ─────────────────────────────────────────────
echo -e "\n${CYAN}[2/5] Configurando variables de entorno...${NC}"

if [ -f ".env" ]; then
  echo -e "${YELLOW}⚠ .env ya existe — no se sobreescribe${NC}"
else
  cp .env.example .env

  # Generar secrets JWT automáticamente
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" 2>/dev/null || openssl rand -hex 64)
  JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" 2>/dev/null || openssl rand -hex 64)

  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/^JWT_SECRET=$/JWT_SECRET=${JWT_SECRET}/" .env
    sed -i '' "s/^JWT_REFRESH_SECRET=$/JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}/" .env
  else
    sed -i "s/^JWT_SECRET=$/JWT_SECRET=${JWT_SECRET}/" .env
    sed -i "s/^JWT_REFRESH_SECRET=$/JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}/" .env
  fi

  echo -e "${GREEN}✓ .env creado con JWT secrets generados automáticamente${NC}"
  echo -e "${YELLOW}⚠ Completar manualmente en .env:${NC}"
  echo "  - POSTGRES_PASSWORD"
  echo "  - GOOGLE_CLIENT_ID"
  echo "  - GOOGLE_CLIENT_SECRET"
  echo "  - SMTP_PASS"
fi

# ─────────────────────────────────────────────
# 3. Crear directorios necesarios
# ─────────────────────────────────────────────
echo -e "\n${CYAN}[3/5] Creando directorios...${NC}"
mkdir -p backend/uploads
echo -e "${GREEN}✓ Directorios creados${NC}"

# ─────────────────────────────────────────────
# 4. Construir contenedores
# ─────────────────────────────────────────────
echo -e "\n${CYAN}[4/5] Construyendo contenedores Docker (puede tardar varios minutos la primera vez)...${NC}"
docker compose build --no-cache
echo -e "${GREEN}✓ Contenedores construidos${NC}"

# ─────────────────────────────────────────────
# 5. Instrucciones finales
# ─────────────────────────────────────────────
echo -e "\n${CYAN}[5/5] Setup completado${NC}"
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Setup completado exitosamente             ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo "Próximos pasos:"
echo ""
echo "  1. Completar las variables faltantes en .env"
echo "     (POSTGRES_PASSWORD, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)"
echo ""
echo "  2. Levantar los servicios:"
echo "     docker compose up"
echo ""
echo "  3. En otra terminal, aplicar migraciones:"
echo "     docker compose exec backend npx prisma migrate dev"
echo ""
echo "  4. Abrir en el navegador:"
echo "     http://localhost:3000  → Frontend"
echo "     http://localhost:4000  → Backend API"
echo "     http://localhost       → Nginx (proxy)"
echo ""
