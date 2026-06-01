# TechOpsHub — Penguin Infrastructure S.A.

Plataforma web interna para la gestión de activos tecnológicos, tickets de soporte y operaciones del departamento de IT, Networking, NOC y Ciberseguridad.

> **Estado:** 🟡 Fase 0 — Infraestructura base en desarrollo  
> **Deployment:** On-premise · Docker · MacBook Air M2 (desarrollo) → Ubuntu Server 24.04 (producción)

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite 5 + Tailwind CSS |
| Backend | Node.js 20 + Express |
| Base de datos | PostgreSQL 16 |
| ORM | Prisma |
| Auth | Google OAuth2 (`@penguin.digital` exclusivo) |
| PDF | Puppeteer |
| Contenedores | Docker + Docker Compose |
| Proxy | Nginx |

---

## Equipo

| Persona | Email | Rol |
|---------|-------|-----|
| Alexis Fernandez | alexis.fernandez@penguin.digital | Project Owner — aprueba todos los PRs |
| Lorenzo Martinez | lorenzo.martinez@penguin.digital | Contributor |
| Jose Ruiz Diaz | jose.ruizdiaz@penguin.digital | Contributor |

---

## Setup inicial (primera vez)

### Prerequisitos
- Docker Desktop para Mac (con soporte Apple Silicon / ARM64)
- Node.js 20+ (opcional — también disponible en el contenedor)
- Cuenta en Google Cloud Console para OAuth2

### 1. Clonar el repositorio

```bash
git clone https://github.com/Alexfernan98/TechOps_Penguin_Infrastructure.git
cd TechOps_Penguin_Infrastructure
```

### 2. Ejecutar el script de setup

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

El script:
- Verifica prerequisitos
- Crea `.env` desde `.env.example` con JWT secrets generados automáticamente
- Construye los contenedores Docker

### 3. Completar las variables en `.env`

```bash
# Abrir en VS Code
code .env
```

Variables que **siempre** hay que completar manualmente:
- `POSTGRES_PASSWORD` — Contraseña para la BD (elegir una segura)
- `GOOGLE_CLIENT_ID` — De Google Cloud Console
- `GOOGLE_CLIENT_SECRET` — De Google Cloud Console
- `SMTP_PASS` — Contraseña de aplicación de Google Workspace

> **Cómo obtener credenciales Google OAuth:**  
> 1. Ir a [console.cloud.google.com](https://console.cloud.google.com)  
> 2. Crear proyecto → APIs y servicios → Credenciales  
> 3. Crear ID de cliente OAuth 2.0 → Aplicación web  
> 4. URI de redirección: `http://localhost:4000/auth/google/callback`

### 4. Levantar los servicios

```bash
docker compose up
```

Primera vez tarda ~2-3 minutos mientras descarga las imágenes base.

### 5. Aplicar migraciones de base de datos

En otra terminal:

```bash
docker compose exec backend npx prisma migrate dev --name init
```

### 6. Verificar que todo funciona

| URL | Servicio |
|-----|---------|
| http://localhost:3000 | Frontend (React) |
| http://localhost:4000/health | Backend API health check |
| http://localhost:4000/api | API root |
| http://localhost | Nginx proxy |

---

## Comandos frecuentes

```bash
# Levantar todos los servicios
docker compose up

# Levantar en background
docker compose up -d

# Ver logs en tiempo real
docker compose logs -f

# Ver logs de un servicio específico
docker compose logs -f backend

# Detener todo
docker compose down

# Detener y borrar volúmenes (⚠️ borra la BD)
docker compose down -v

# Aplicar nueva migración de Prisma
docker compose exec backend npx prisma migrate dev

# Abrir Prisma Studio (explorador visual de la BD)
docker compose exec backend npx prisma studio

# Ejecutar seed de datos iniciales
docker compose exec backend npm run db:seed

# Reconstruir un contenedor específico
docker compose build backend
docker compose up -d backend
```

---

## Estructura del proyecto

```
TechOps_Penguin_Infrastructure/
├── backend/
│   ├── src/
│   │   ├── controllers/    # Lógica de cada endpoint
│   │   ├── routes/         # Definición de rutas Express
│   │   ├── middleware/      # Auth, roles, validación
│   │   ├── services/       # Lógica de negocio
│   │   ├── utils/          # Helpers
│   │   ├── prisma/         # seed.js
│   │   └── index.js        # Entry point
│   ├── prisma/
│   │   └── schema.prisma   # Schema de la BD
│   ├── uploads/            # Archivos subidos (gitignored)
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # Componentes reutilizables
│   │   │   ├── ui/         # Botones, inputs, modals
│   │   │   ├── layout/     # Sidebar, Header, Layout
│   │   │   ├── assets/     # Componentes del módulo Activos
│   │   │   ├── tickets/    # Componentes del módulo Tickets
│   │   │   └── dashboard/  # Componentes del Dashboard
│   │   ├── pages/          # Páginas completas
│   │   ├── hooks/          # Custom hooks
│   │   ├── store/          # Zustand stores
│   │   ├── services/       # Llamadas a la API (axios)
│   │   ├── utils/          # Helpers
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── Dockerfile
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── nginx/
│   └── nginx.conf
├── scripts/
│   └── setup.sh
├── .github/
│   └── workflows/
│       └── ci.yml
├── docker-compose.yml
├── .env.example            # Template — versionar ✅
├── .env                    # Secrets reales — gitignored ✅
├── .gitignore
└── README.md
```

---

## Estrategia de branches y commits

```
main          ← producción — solo Alexis mergea
└── develop   ← integración
    ├── feat/frontend-[nombre]
    ├── feat/backend-[nombre]
    ├── feat/integration-[nombre]
    └── fix/[descripcion]
```

### Convención de commits

```
feat(assets): agregar endpoint de búsqueda por TAG
fix(auth): corregir redirect loop en Google OAuth
docs(context): actualizar estado Fase 0
chore(docker): ajustar healthcheck de postgres
```

---

## Plan de fases

| Fase | Descripción | Estado |
|------|-------------|--------|
| 0 | Infraestructura base + Auth + Layout | 🟡 En curso |
| 1 | Inventario de activos | 🔴 Pendiente |
| 2 | Actas de entrega y devolución | 🔴 Pendiente |
| 3 | Sistema de tickets | 🔴 Pendiente |
| 4 | Dashboard y analytics | 🔴 Pendiente |
| 5 | Notificaciones + deploy final | 🔴 Pendiente |

---

*Documento técnico interno — Penguin Infrastructure S.A. · Hernandarias, Paraguay*
