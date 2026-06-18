# NetHub — Penguin Infrastructure S.A.

Plataforma web interna para la gestión de activos tecnológicos, actas de
entrega/devolución/baja, tickets de soporte y operaciones del departamento
de IT, Networking, NOC y Ciberseguridad.

> **Sede**: PE1H — Hernandarias, Paraguay
> **Deployment**: On-premise · Docker · MacBook (desarrollo) → Ubuntu Server 24.04 (producción)
> **Documentación para colaboradores AI**: ver [CLAUDE.md](CLAUDE.md)

---

## Hito actual

**Última release a `main`**: 2026-06-18 — **v0.7.0** ([PR #26](https://github.com/Alexfernan98/NetHub_PE1H/pull/26) · [tag](https://github.com/Alexfernan98/NetHub_PE1H/releases/tag/v0.7.0))

**Novedades v0.7.0**
- 🆕 **Equipos compartidos** (PCs del NOC, equipos de turno rotativo): múltiples usuarios asignados con un responsable administrativo. Actas listan a los autorizados; bajas por daño piden firma del operador específico.
- 🆕 **Restaurar bajas**: revertir activos retirados con motivo registrado en audit log.
- 🆕 **Sort y filtros consistentes** en Activos, Tickets, Actas, Usuarios, Auditoría — botón ✕ por filtro, "Limpiar todo" verde, "Solo dados de baja" naranja.
- 🆕 **Versionado SemVer** arrancado — Sidebar muestra la versión real del paquete.

**Lo que está desplegado** (Fases 1-5 + Etapa 2 de Actas + v0.7.0):

- ✅ **Autenticación** Google OAuth 2.0 restringida al dominio `@penguin.digital`,
  con refresh token persistido para integración con Drive.
- ✅ **Inventario de activos** con TAG correlativo por categoría, importación CSV,
  barcode scanner (en HTTPS), drawer con detalle/historial/actas.
- ✅ **Campos por categoría**: mousepad/soporte no piden MAC ni SN; celular/tablet
  piden IMEI. 11 categorías base (PC, notebook, monitor, impresora, TV, mouse,
  mousepad, teclado, soporte, celular, tablet).
- ✅ **Actas v2** — entrega, devolución y baja con:
  - Numeración `ENT-2026-NNNN-TAG`, `DEV-...`, `BAJ-...` por tipo y año.
  - Plantilla A4 con logo Penguin embebido y cláusulas adaptadas al grupo
    del activo (COMPUTER / PERIPHERAL / ACCESSORY).
  - Sub-tipos de baja: `DAMAGE`, `THEFT`, `LOSS`, `OBSOLETE`.
  - Firma del usuario responsable en bajas por daño/robo/extravío.
  - **Actas legacy**: registro de actas firmadas antes del despliegue,
    enlazando al PDF original en Drive.
- ✅ **Integración Google Drive** (user-based OAuth):
  - Estructura `{tipo}/{año}/{categoría}/file.pdf`.
  - Permisos compartidos con el dominio Penguin (sin "You need access").
  - Listado de archivos existentes en Drive desde el módulo Actas.
- ✅ **Tickets** con SLA por prioridad, asignación, CSAT y comentarios.
- ✅ **Dashboard** con KPIs (activos, tickets críticos, SLA, garantías por vencer),
  gráficos (estado, departamento, prioridad, volumen mensual).
- ✅ **Audit log** con snapshots before/after de toda operación destructiva.
- ✅ **Notificaciones** in-app + email (SMTP Google Workspace).
- ✅ **Branding**: logo Penguin (pingüino) en login, sidebar, favicon y PDFs.
  Login redesign con card blanco sobre gradient azul corporativo.
- ✅ **HTTPS self-signed** + soporte para acceso LAN vía `nip.io`.

**En desarrollo / próximos hitos**:
- 🟡 Despliegue del servicio en VM Ubuntu 24.04 (planificación en curso).
- 🟡 Backup automatizado de DB + carpetas Drive.
- 🟡 Carga masiva del inventario real (post-despliegue) → camino a **v1.0.0**.
- 🔴 Por definir: módulo de licencias, control de accesos, monitoreo.

La app está en evolución constante — se documentan aquí los hitos visibles
al usuario en cada release a `main`.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite 5 + Tailwind CSS (darkMode: class) |
| Backend | Node.js 20 + Express + Passport (Google OAuth) |
| Base de datos | PostgreSQL 16 (db: `techopshub`, user: `techops`) |
| ORM | Prisma |
| PDF | Puppeteer + plantilla HTML A4 |
| Storage externo | Google Drive (scopes `drive.file` + `drive.readonly`) |
| Email | Nodemailer + SMTP Google Workspace (fallback a console.log) |
| Contenedores | Docker + Docker Compose |
| Proxy | Nginx con HTTPS self-signed |

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
- Docker Desktop (con soporte Apple Silicon / ARM64 o x86_64)
- Node.js 20+ (opcional — también disponible en el contenedor)
- Cuenta en Google Cloud Console para OAuth2
- Carpetas de Drive creadas para Entregas / Devoluciones / Bajas

### 1. Clonar el repositorio

```bash
git clone https://github.com/Alexfernan98/NetHub_PE1H.git
cd NetHub_PE1H
```

### 2. Ejecutar el setup

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

El script:
- Verifica prerequisitos.
- Crea `.env` desde `.env.example` con JWT secrets generados automáticamente.
- Construye los contenedores Docker.

### 3. Completar `.env`

Variables que **siempre** hay que completar manualmente:

| Variable | De dónde sale |
|---|---|
| `POSTGRES_PASSWORD` | Elegir una segura |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console |
| `GOOGLE_OAUTH_DOMAIN` | `penguin.digital` |
| `SMTP_PASS` | App password de Google Workspace (opcional) |
| `DRIVE_FOLDER_DELIVERIES` | ID de la carpeta de Drive "Entregas" |
| `DRIVE_FOLDER_RETURNS` | ID de la carpeta de Drive "Devoluciones" |
| `DRIVE_FOLDER_RETIREMENTS` | ID de la carpeta de Drive "Bajas" |

> **OAuth en Google Cloud Console**
> - APIs habilitadas: Google+ API, Google Drive API.
> - Authorized redirect URIs: `https://<tu-host>/auth/google/callback` (HTTPS obligatorio para scope `drive.readonly`).
> - Scopes: `profile`, `email`, `drive.file`, `drive.readonly`.

### 4. Generar certs HTTPS para LAN

```bash
./scripts/gen-certs.sh
```

### 5. Levantar los servicios

```bash
docker compose up
```

Primera vez tarda ~2-3 minutos descargando imágenes base.

### 6. Aplicar migraciones y seed

```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run db:seed
```

### 7. Verificar

| URL | Servicio |
|-----|---------|
| https://localhost | Frontend (vía nginx con HTTPS) |
| http://localhost:4000/health | Backend health check |
| http://localhost:4000/api | API root |

Para acceso desde la LAN sin tocar DNS, usar `https://<ip>.nip.io` (ej.
`https://10-0-0-5.nip.io`). El backend CORS acepta `*.nip.io`, `*.sslip.io`
y `*.traefik.me` automáticamente.

---

## Comandos frecuentes

```bash
# Reiniciar backend (tras tocar *.js del backend)
docker compose restart backend

# Ver logs
docker compose logs -f --tail=20 backend

# Consultar DB
docker compose exec -T postgres psql -U techops -d techopshub -c "SELECT ..."

# Detener todo
docker compose down

# Detener y borrar volúmenes (⚠️ borra la BD)
docker compose down -v

# Aplicar nueva migración de Prisma
docker compose exec backend npx prisma migrate dev

# Prisma Studio (explorador visual)
docker compose exec backend npx prisma studio
```

---

## Estructura del proyecto

```
NetHub_PE1H/
├── CLAUDE.md                        # Convenciones para colaboradores AI
├── README.md                        # Este archivo
├── backend/
│   ├── src/
│   │   ├── config/passport.js       # OAuth + persist refresh_token
│   │   ├── middleware/auth.js       # authenticate, requireRole
│   │   ├── routes/                  # Un archivo por recurso REST
│   │   ├── services/
│   │   │   ├── actaTemplate.js      # HTML del acta
│   │   │   ├── drive.js             # OAuth tokens por user, subfolders
│   │   │   ├── email.js, notify.js, cron.js, auditLog.js
│   │   │   └── assets/logo-penguin.png
│   │   └── index.js
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── uploads/                     # Gitignored
├── frontend/
│   ├── src/
│   │   ├── api/                     # Clientes axios por recurso
│   │   ├── components/
│   │   │   ├── layout/              # Sidebar, AppLayout
│   │   │   └── ui/                  # Modal, Drawer, Badge, etc.
│   │   ├── lib/                     # categoryFields.js y otros helpers
│   │   ├── pages/                   # Una por feature
│   │   └── store/authStore.js
│   └── public/                      # Logo, favicons
├── nginx/                           # Reverse proxy + HTTPS
├── scripts/
│   ├── setup.sh
│   └── gen-certs.sh
├── docker-compose.yml
├── .env.example                     # Template (versionado)
└── .env                             # Secrets (gitignored)
```

---

## Estrategia de branches

```
main          ← producción — autorización explícita por merge
└── develop   ← integración
    ├── feat/<nombre>
    ├── fix/<nombre>
    └── docs/<nombre>
```

**Flujo**: `feat/...` → PR a `develop` → merge → STOP → autorización del owner
→ PR `develop` a `main` → merge.

Ver [CLAUDE.md](CLAUDE.md) para detalle completo de convenciones, reglas
operativas y patrones específicos del proyecto.

---

*Documento técnico interno — Penguin Infrastructure S.A. · Hernandarias, Paraguay*
