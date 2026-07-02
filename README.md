# NetHub — Penguin Infrastructure S.A.

Plataforma web interna para la gestión de activos tecnológicos, actas de
entrega/devolución/baja, tickets de soporte y operaciones del departamento
de IT, Networking, NOC y Ciberseguridad.

> **Sede**: PE1H — Hernandarias, Paraguay
> **Deployment**: On-premise · Docker · MacBook (desarrollo) → VM Ubuntu 24.04 (producción, **en vivo**)
> **Documentación para colaboradores AI**: ver [CLAUDE.md](CLAUDE.md)

---

## Hito actual

**Última release a `main`**: 2026-07-02 — **v0.8.0** (Sprint 1 · inventario de infraestructura + Almacén)

**Novedades v0.8.0 (Sprint 1)**
- 🆕 **Inventario más allá de IT**: categorías de **Networking** (switch, firewall, AP), **CCTV** (cámaras) y **Servidores/DC** (server, UPS, rack), con campos propios por tipo (IP de gestión, puertos, rol, tipo de cámara, canal NVR, HA, etc.).
- 🆕 **Estado "En producción"** para infraestructura instalada; filtro por **dominio** (IT / Networking / CCTV / DC).
- 🆕 **Módulo Almacén**: stock por cantidad con grupos gestionables, consumibles vs convertibles, movimientos (entrada/salida/ajuste) con bitácora, y alerta de stock bajo.
- 🆕 **Poner en producción / Dar de alta desde stock**: un ítem convertible genera un activo con TAG automático y descuenta stock, en una transacción.
- 🆕 **Import masivo con plantilla Excel** (dropdowns de Estado/Condición/Tipo/Ubicación/Grupo) para activos y almacén; TAG autogenerado.
- 🆕 Mensajes de error claros para datos duplicados (serial/barcode/etc.).

**Release anterior**: v0.7.0 (2026-06-18) — equipos compartidos, restaurar bajas, sort/filtros consistentes, versionado SemVer.

**Lo que está desplegado** (Fases 1-5 + Etapa 2 de Actas + v0.8.0):
- ✅ **Almacén / Stock**: repuestos y consumibles por cantidad, grupos gestionables,
  movimientos con historial, despliegue de convertibles a Inventario.
- ✅ **Inventario de infraestructura**: switches, firewalls, APs, cámaras, servidores,
  UPS, racks — con sus campos técnicos y estado "En producción".

- ✅ **Autenticación** Google OAuth 2.0 restringida al dominio `@penguin.digital`,
  con refresh token persistido para integración con Drive.
- ✅ **Inventario de activos** con TAG correlativo por categoría, import masivo
  (plantillas Excel con dropdowns / CSV), barcode scanner (en HTTPS), drawer con
  detalle/historial/actas, filtro por dominio (IT / Networking / CCTV / DC).
- ✅ **Campos por categoría**: mousepad/soporte no piden MAC ni SN; celular/tablet
  piden IMEI; switch pide puertos/rol; cámara pide tipo/canal NVR/MP; firewall HA.
  18 categorías (IT: PC, notebook, monitor, impresora, TV, mouse, mousepad,
  teclado, soporte, celular, tablet · Networking: switch, firewall, AP · CCTV:
  cámara · DC: servidor, UPS, rack).
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

**Infraestructura de producción** (operativa):
- ✅ Desplegado en VM Ubuntu 24.04 (LAN), acceso HTTPS vía `nip.io`.
- ✅ Backup automático diario de DB + uploads (cron, retención 14 días) y dump
  pre-deploy antes de cada release.
- ✅ Flujo Mac (dev) → GitHub → VM (`./scripts/deploy.sh`) con rollback por tags.

**Roadmap (próximos sprints)**:
- 🟡 **Sprint 2** — Mapa interactivo del sitio (plano + pins por categoría) y
  puertos/SFPs de los switches (qué transceiver hay en cada puerto y a qué conecta).
- 🟡 **Sprint 3** — Off-boarding de funcionarios (baja + devolución de equipos + accesos).
- 🟡 **Sprint 4** — Mantenimientos programados.
- 🟡 **Sprint 5** — Licencias (Autocad, Fortigate, SCADA, SQL) con vencimientos.
- 🟡 **Sprint 6** — Auditorías de equipos (integración Wazuh + Workspace).
- 🎯 **v1.0.0** cuando el sistema esté consolidado con los datos reales cargados.

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
| Excel | ExcelJS (plantillas de import con listas desplegables) |
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

## Producción y despliegue

NetHub corre en producción en una **VM Ubuntu 24.04** (LAN de PE1H), accesible por
HTTPS vía `nip.io`. El desarrollo se hace en la Mac; a producción solo llega
código por `git pull` — **la VM nunca se edita a mano**.

**Flujo de release** (Mac → GitHub → VM):
1. `feat/*` → PR a `develop` → merge.
2. Bump de versión (`frontend/` + `backend/` `package.json`) al promover a `main`.
3. PR `develop` → `main` → merge → `git tag vX.Y.Z && git push --tags`.
4. En la VM, un solo comando:
   ```bash
   cd /opt/nethub && ./scripts/deploy.sh
   ```
   `deploy.sh` hace: dump pre-deploy → `git pull` → `docker compose up -d --build`
   → sincroniza dependencias del contenedor (`npm install --include=dev` +
   `prisma generate`, porque el volumen `node_modules` persiste deps viejas) →
   aplica migraciones Prisma → muestra estado.

**Rollback** (si un deploy rompe algo):
```bash
./scripts/rollback.sh vX.Y.Z          # vuelve al tag anterior (safety dump + rebuild)
# y si hace falta restaurar datos, el dump pre-deploy está en:
#   /opt/backups/db/pre-deploy/
```
Las migraciones son aditivas (no borran), así que volver el código a una versión
anterior no rompe la DB.

**Backups**: cron diario (`scripts/backup-daily.sh`) de DB + uploads en
`/opt/backups/` con retención de 14 días; más un dump pre-deploy por cada release.

**Cambios en `.env` de la VM**: `docker compose restart` NO relee `.env` — usar
`./scripts/reload-env.sh <servicio>` (hace `up -d --force-recreate`).

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
│   │   │   ├── assetTag.js          # TAG correlativo por categoría
│   │   │   ├── importXlsx.js        # Plantillas Excel (dropdowns) + parseo
│   │   │   ├── prismaError.js       # Mensajes claros de errores de Prisma
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
│   ├── setup.sh                     # Setup inicial (dev)
│   ├── gen-certs.sh                 # Certs HTTPS self-signed para LAN
│   ├── deploy.sh                    # Deploy en la VM (pull + build + migraciones)
│   ├── rollback.sh                  # Volver a un tag anterior + restaurar DB
│   ├── backup-daily.sh              # Backup diario DB + uploads (cron)
│   └── reload-env.sh                # Recrear contenedor tras editar .env
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
