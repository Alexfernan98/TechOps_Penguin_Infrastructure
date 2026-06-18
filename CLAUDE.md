# CLAUDE.md — NetHub (Penguin Infrastructure)

> **Lee este archivo COMPLETO antes de modificar código.** Contiene las
> convenciones del proyecto, reglas operativas inviolables del Project Owner
> y atajos para no quemar contexto/tokens.

## 1. Identidad del proyecto

- **Nombre comercial**: NetHub (rename desde TechOpsHub, completado 2026-06).
- **Empresa**: Penguin Infrastructure S.A. · Sede Hernandarias (PE1H), Paraguay.
- **Owner**: Alexis Fernández — SUPER_ADMIN, Networking & Cybersecurity Leader
  (alexis.fernandez@penguin.digital).
- **Repo**: https://github.com/Alexfernan98/NetHub_PE1H
- **Idioma**: español (Paraguay). Todo lo visible al usuario va en español.

**La app está en evolución constante.** Hoy cubre activos, actas (entrega/
devolución/baja), tickets, usuarios, audit log, dashboard y notificaciones,
pero el alcance crece de forma incremental: vendrán módulos nuevos (gestión
de licencias, control de accesos, monitoreo, etc.). Asumir que cualquier
módulo actual puede expandirse o que aparecerán módulos nuevos. **No diseñar
para "el sistema definitivo"** — diseñar para lo pedido hoy, dejando puertas
abiertas razonables sin sobre-ingeniería.

## 2. Reglas operativas — INVIOLABLES

Estas reglas vienen del Project Owner. Romperlas es bloqueante.

1. **Nunca atribuir commits ni PRs a Claude.** Sin `Co-Authored-By: Claude`,
   sin footer "Generated with Claude Code", sin emojis del bot.
2. **Nunca incluir en commits/PRs**: IPs privadas (RFC1918), hostnames internos,
   credenciales, paths absolutos del home, secretos. Usar placeholders
   (`<IP_DEL_SERVIDOR>`, `<USER>`).
3. **Merge a `main` requiere autorización explícita por turno.** "dale",
   "mergeá a main", "subí a main". Una autorización vale solo para ese merge.
   Flujo siempre: feature → PR a develop → merge develop → STOP y preguntar
   → PR develop a main → merge main.
4. **Verificar antes de mergear.** Nunca mergear sin que el owner haya probado
   en el browser. Reiniciar backend y pedir hard refresh si tocaste UI o
   plantillas.
5. **Acciones destructivas siempre con confirmación**: `git reset --hard`,
   `--force`, borrar branches, drop tables, rm de archivos no escritos por mí.

## 3. Stack y comandos esenciales

| Capa | Tecnología |
|---|---|
| Backend | Node.js + Express + Prisma + Passport (Google OAuth) |
| Frontend | React 18 + Vite + Tailwind (`darkMode: 'class'`) |
| DB | PostgreSQL 16 (db: `techopshub`, user: `techops`) |
| Infra | Docker Compose, nginx reverse proxy, HTTPS self-signed |
| Storage | Google Drive (OAuth user-based, scope `drive.file`+`drive.readonly`) |
| PDF | Puppeteer + plantilla HTML en `backend/src/services/actaTemplate.js` |

**Comandos que vas a usar siempre** (desde la raíz del proyecto):

```bash
docker compose restart backend     # Tras tocar *.js del backend
docker compose logs -f --tail=20 backend
docker compose exec -T postgres psql -U techops -d techopshub -c "SELECT ..."
./scripts/gen-certs.sh             # Regenerar certs HTTPS
```

Frontend usa HMR de Vite — los cambios `.jsx`/`.css` se ven con refresh.
NO reiniciar el contenedor del frontend salvo cuando tocás `vite.config.js`
o `package.json`.

## 4. Convenciones de código

### Routing (CRÍTICO)
- **Todas las rutas REST llevan prefijo `/api/*`.** Sin el prefijo colisionan
  con rutas del SPA.
- Excepción única: `/auth/*` (callback de Google está fijo en Google Console).
- `/uploads/*` sirve estáticos sin `/api`.

### Estructura backend
```
backend/src/
  config/passport.js        ← OAuth + persist refresh_token
  middleware/auth.js        ← authenticate, requireRole
  routes/<resource>.js      ← un archivo por recurso REST
  services/
    actaTemplate.js         ← HTML del acta (recibe el acta ya aplanado)
    drive.js                ← OAuth tokens por user, subfolders, permisos
    email.js                ← nodemailer + fallback a console.log
    notify.js, auditLog.js, cron.js
    assets/logo-penguin.png ← logo embebido en PDFs
prisma/
  schema.prisma             ← una migración por feature, fecha ISO en nombre
```

### Estructura frontend
```
frontend/src/
  api/<resource>.js         ← cliente axios delgado por recurso
  components/layout/        ← Sidebar, AppLayout
  components/ui/            ← Modal, Drawer, Badge, UserPicker, etc.
  lib/                      ← helpers puros (ej. categoryFields.js)
  pages/<Resource>Page.jsx  ← una página por feature
  store/authStore.js        ← Zustand
public/                     ← logo, favicons (servidos en raíz)
```

### Patrones específicos del proyecto
1. **Metadata en Json antes que columnas nuevas.** Campos derivados
   (`number`, `statusActa`, `tipoBaja`, `legacy`, `signedDriveUrl`) viven en
   `Acta.metadata` y se aplanan en el response. Solo crear columna si se
   usa en `WHERE` o `ORDER BY`.
2. **`displayName` aparte del `id`.** Las actas tienen nombre legible
   (`ACTA-ENTREGA-MON-001-2026-06-15-lorenzo`) usado como filename en Drive.
3. **`fieldsForCategory(slug)`** decide qué campos del activo se muestran
   por categoría (mousepad no pide MAC, celular pide IMEI).
4. **Bajas con DAMAGE/THEFT/LOSS llevan firma del usuario responsable** —
   el receptor del acta se busca automáticamente como el último asignado.
   OBSOLETE es acta interna (solo firma IT).
5. **Cláusulas del acta por grupo**: COMPUTER (6, con auditoría), PERIPHERAL
   (5, sin auditoría), ACCESSORY (3 mínimas).
6. **Drive folder structure**: `{tipo}/{año}/{categoría}/file.pdf`.
   Folder IDs raíz en `.env`, NO se commitean.
7. **CORS acepta LAN privada + wildcards `nip.io/sslip.io/traefik.me`.**
   No hardcodear hosts.
8. **Cookies seguras solo en HTTPS**: derivado de `X-Forwarded-Proto`.
9. **Legacy actas**: `POST /api/actas/legacy` registra actas firmadas antes
   del despliegue, enlazando al PDF en Drive. Marca `metadata.legacy: true`.

### Estilo de código
- **No agregues comentarios obvios.** Solo cuando el *porqué* no es claro.
- **No documentes con docstrings largos.** Una línea si hace falta.
- **Prefer Edit sobre Write.** Solo Write si es archivo nuevo o rewrite total.
- **Validaciones solo en bordes** (user input, APIs externas). Internamente, confiar.
- **Sin features ni abstracciones especulativas.** YAGNI.

## 5. Flujo de cambios (Git)

```
main         ←─ release estable (autorización explícita por merge)
  ↑
develop      ←─ integración (autorización solo para promover a main)
  ↑
feat/xxx     ←─ rama por feature, base = develop
```

**Pasos**:
1. `git checkout develop && git pull`
2. `git checkout -b feat/<nombre-corto-kebab>`
3. Codear, probar localmente.
4. **Pedir al owner que pruebe en browser.** Hard refresh + golden + edge.
5. Commit en español, sin co-author Claude.
6. `git push -u origin feat/<nombre>`
7. `gh pr create --base develop --title "..." --body "..."` (con test plan).
8. OK del owner → `gh pr merge <n> --merge --admin --delete-branch`.
9. **STOP**: preguntar si promover a main.
10. Si sí: `gh pr create --base main --head develop` + merge.

**Formato de commit**:
```
feat(area): título corto en imperativo

- Bullet con el qué + por qué
- Bullet con consecuencias / files clave
```
`area`: `actas`, `assets`, `auth`, `drive`, `dashboard`, `infra`,
`branding`, `ui`, `db`. No usar `feat:` pelado.

## 6. Estado del repositorio (instrucción permanente)

**Cada vez que un PR se mergea a `main`**, actualizar la sección "Hito
actual" del [README.md](README.md) con:
- Fecha del merge.
- Rango de PRs incluidos (`#N` → `#M`).
- Features/cambios visibles para el usuario.
- Módulos pendientes o en progreso.

No dejar el README desfasado — debe reflejar lo que está realmente desplegado.

### Versionado (SemVer)

La versión se muestra en el sidebar y se lee de `frontend/package.json` →
`version`. `backend/package.json` debe llevar la **misma versión** para
mantenerlas en sync.

**Cuándo bumpear** (antes de mergear a `main`):
- `PATCH` (0.7.**1**) — bugfix sin features nuevas visibles al usuario.
- `MINOR` (0.**8**.0) — feature visible (ej. equipos compartidos, módulo nuevo).
- `MAJOR` (**1**.0.0) — sólo cuando el sistema está estable en producción
  para todos los empleados (deploy en VM + backups + alta real de activos).

**Cómo bumpear**:
1. Editar `frontend/package.json` y `backend/package.json` → `version`.
2. Mencionar el bump en el cuerpo del PR a main.
3. Tras el merge: `git tag v0.X.Y && git push --tags`.
4. Actualizar la tabla del README con el tag.

No bumpear en cada merge a `develop`. Sólo en merges a `main`.

## 7. Economía de contexto y tokens

Cosas que queman contexto y debés evitar:
- **No leer archivos enteros si solo necesitás 20 líneas.** Usá `Read` con
  `offset`+`limit`, o `grep -n` con `head`.
- **No correr `find` desde `/`** — siempre desde `.` o subpath.
- **No spawnear Agents/subagents para tareas pequeñas.** Solo si la
  búsqueda cubre >3 archivos y no sabés dónde buscar.
- **No re-leer archivos que editaste** — Edit ya validó el resultado.
- **No usar `cat`/`echo`/`head`/`tail`** cuando hay tool dedicado.
- **No correr `docker compose logs` sin `--tail=N`.**
- **Tool calls en paralelo cuando son independientes** (un turno, varios `<tool_use>`).
- **Mensajes al user: cortos.** Una sentencia de status, un bullet por cambio.
- **No re-derivar lo ya establecido** en la conversación.
- **No narrar el plan antes de ejecutarlo** — ejecutá y reportá.

Cuando el contexto pase 80%, sugerir `/compact` al owner.

## 8. Memorias activas (`~/.claude/projects/.../memory/`)

Revisar antes de decidir:
- `feedback_commits.md` — reglas de commit (sin Claude, sin IPs).
- `project_techopshub.md` — fases, decisiones de arquitectura.
- `user_alexis.md` — rol, contexto del owner.

Actualizar cuando: el owner corrige una decisión, confirma un patrón no
obvio, o cambia algo del rol/proyecto.

## 9. Variables de entorno (`.env` — NUNCA commitear)

```
DATABASE_URL=postgresql://techops:<pwd>@postgres:5432/techopshub
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_DOMAIN=penguin.digital
DRIVE_FOLDER_DELIVERIES, DRIVE_FOLDER_RETURNS, DRIVE_FOLDER_RETIREMENTS
SMTP_HOST, SMTP_USER, SMTP_PASS (opcional — sin SMTP cae a console.log)
JWT_SECRET, COOKIE_SECRET
```
`.env.example` mantiene los nombres con valores vacíos/placeholders.

## 10. Errores frecuentes a evitar

- **No mergees sin preguntar al owner.** Aunque develop esté green.
- **No olvides `docker compose restart backend`** tras tocar `*.js` del backend.
- **No tires migraciones a mano sin Prisma**, salvo casos puntuales (seed
  de categorías). Cuando lo hagas, dejá comentario en el PR.
- **No uses `git add -A` sin antes ver `git status --short`** — se cuelan
  `.DS_Store`, dumps, archivos del IDE.
- **No agregues `Co-Authored-By: Claude`** ni siquiera "por costumbre".

## 11. Releases relevantes (referencia rápida)

| PR | Fecha | Contenido |
|---|---|---|
| [#14](https://github.com/Alexfernan98/NetHub_PE1H/pull/14) | 2026-06-17 | Actas v2: campos por categoría, firma usuario en bajas, Drive year/category |
| [#15](https://github.com/Alexfernan98/NetHub_PE1H/pull/15) | 2026-06-17 | Branding: logo Penguin (pingüino), login redesign, favicons |
| [#17](https://github.com/Alexfernan98/NetHub_PE1H/pull/17) | 2026-06-18 | Actas legacy + acceso a actas desde el detalle del activo |

Mantener la tabla limitada a los últimos ~5 hitos. Hitos viejos van al README.

## 12. Mantenimiento de este archivo

CLAUDE.md es un documento vivo. Actualizarlo cuando:

**Agregar**:
- Surge un patrón nuevo que vamos a repetir (ej. nuevo tipo de modal, nueva
  convención de naming).
- Aparece un módulo nuevo con sus propias reglas (ej. cuando empiece
  "Licencias", documentar sus particularidades).
- El owner corrige un comportamiento mío y la regla aplica a futuros cambios.
- Cambia el stack (nueva librería, nuevo servicio externo).

**Quitar / reescribir**:
- Una sección describe un patrón que dejamos de usar.
- Un comando ya no aplica porque cambió la infra.
- Una regla queda contradicha por una nueva forma de trabajar acordada con
  el owner.
- La tabla de "Releases relevantes" tiene >5 entradas (mover las viejas al README).

**Antes de actualizar CLAUDE.md**:
1. Mostrar el diff al owner antes de commitearlo.
2. Si es un cambio menor (typo, agregar un bullet), commitearlo junto al PR
   que motivó el cambio.
3. Si es una sección nueva o reescritura, hacerlo en commit separado con
   mensaje `docs(claude): ...`.

No dejar CLAUDE.md describir un mundo que ya no existe.
