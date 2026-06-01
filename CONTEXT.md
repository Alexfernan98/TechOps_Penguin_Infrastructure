# CONTEXT.md — TechOpsHub
> **Documento de contexto vivo.** Actualizar después de cada fase completada y después de cada decisión técnica importante.
> Última actualización: Junio 2026
> Estado general del proyecto: 🟢 LISTO PARA ARRANCAR FASE 0

---

## 1. Descripción del proyecto

**TechOpsHub** es una plataforma web interna para el departamento de IT, Networking, NOC y Ciberseguridad de Penguin Infrastructure S.A.

Reemplaza procesos manuales en Excel y papel por un sistema centralizado, auditable y colaborativo que permite gestionar activos tecnológicos, tickets de soporte y flujos operativos del departamento.

**Filosofía:**
- **Modular:** cada área (IT, NOC, Ciberseg, Networking) es un módulo independiente
- **Colaborativo:** el equipo IT contribuye vía Git/GitHub con aprobación del líder
- **On-premise primero:** red local, sin salida a internet en Fase 1
- **Auditable:** ningún dato se borra físicamente, todo tiene historial
- **No-code para el usuario:** Alexis describe en lenguaje humano, Claude escribe todo el código

---

## 2. Empresa

| Campo | Valor |
|-------|-------|
| Razón social | Penguin Infrastructure S.A. / Penguin Group S.A. |
| Dominio Google Workspace | @penguin.digital |
| SSO | Google OAuth2 — solo cuentas @penguin.digital |
| Empleados totales | 50–200 |
| Sede principal | Hernandarias (PE1H) |
| Otras sedes | Asunción · Central |
| Equipo IT | 3 personas |
| Sistema previo | Excel y papel — sin trazabilidad |
| Inventario actual | CSV importado — 55 activos, datos se siguen recolectando desde Junio 2026 |
| Despliegue Fase 1 | Local en MacBook Air M2 (macOS Sequoia 15.5) via Docker |
| Despliegue producción futuro | Ubuntu Server 24.04 on-premise |
| Acceso externo Fase 1 | Por IP local — sin dominio interno por ahora |
| Retención de datos | Mínimo 1 año |
| App móvil | No requerida en Fase 1 |

---

## 3. Estructura organizacional — Penguin Hernandarias

```
Ricardo Galeano — VP of DC Operations
│
├── Willian Baez — Infrastructure Manager
│   ├── Head of Maintenance (Marcelo)
│   │   ├── Maintenance Leader
│   │   │   └── Maintenance Technician
│   │   └── Sub-Station Leader
│   │       └── Sub-Station Operator
│   └── Head of Mining (Allan)
│       ├── Networking & Cybersecurity Leader  ← ALEXIS FERNANDEZ (dueño del proyecto)
│       │   ├── NOC
│       │   ├── Networking Supervisor          ← LORENZO MARTINEZ
│       │   └── Networking Technician          ← JOSE RUIZ DIAZ
│       ├── Microelectronics Leader
│       │   └── Microelectronics Technician
│       ├── Mining Leader
│       │   └── Mining Technician
│       └── Automation Leader
│       │  └── Automation Technician
│       └── Software Developer
└── Katherine Delvalle — Facilities Manager
    ├── Leader of Facilities
    │   ├── Warehouse
    │   ├── Cleaning Crew
    │   ├── MSU
    │   └── General Services
    ├── Safety Officer
    └── Occupational Health
```

### Departamentos y subdivisiones para el campo de usuario en la app

| Valor en BD | Nombre visible | Departamento padre | Tipo|
| ----------------------------- | ---------------------------- | ------------------ | ------------ |
| `MINING_OPS`                  | Mining Ops                   | —                  | Departamento |
| `MINING_OPS_MINING_TECH`      | Mining Tech                  | Mining Ops         | Equipo       |
| `MINING_OPS_MICROELECTRONICS` | Microelectrónica             | Mining Ops         | Equipo       |
| `MINING_OPS_NETWORKING_CS`    | Networking & Cybersecurity   | Mining Ops         | Equipo       |
| `MINING_OPS_SOFTWARE`         | Software Development         | Mining Ops         | Equipo       |
| `MINING_OPS_AUTOMATION`       | Automatización               | Mining Ops         | Equipo       |
| `MAINTENANCE`                 | Mantenimiento                | —                  | Departamento |
| `MAINTENANCE_TECH`            | Maintenance Tech             | Mantenimiento      | Equipo       |
| `MAINTENANCE_LAB`             | Laboratorio                  | Mantenimiento      | Equipo       |
| `MAINTENANCE_SUBSTATION`      | Subestación                  | Mantenimiento      | Equipo       |
| `FACILITIES`                  | Facilities                   | —                  | Departamento |
| `FACILITIES_MSU`              | MSU                          | Facilities         | Equipo       |
| `FACILITIES_WAREHOUSE`        | Warehouse                    | Facilities         | Equipo       |
| `FACILITIES_GENERAL_SERVICES` | Servicios Generales          | Facilities         | Equipo       |
| `FACILITIES_SAFETY`           | Safety & Occupational Health | —                  | Departamento |
| `INFRASTRUCTURE`              | Infrastructure               | —                  | Departamento |


---

## 4. Equipo del proyecto

| Persona | Email | Rol empresa | Rol proyecto | GitHub | Permisos repo |
|---------|-------|-------------|--------------|--------|---------------|
| Alexis Fernandez | alexis.fernandez@penguin.digital | Networking & Cybersecurity Leader | **Project Owner** — aprueba todos los PRs, único que mergea a `main` | @Alexfernan98 | Maintainer |
| Lorenzo Martinez | lorenzo.martinez@penguin.digital | Networking Supervisor | **Contributor** — features asignadas | *(pendiente cuenta GitHub)* | Write |
| Jose Ruiz Diaz | jose.ruizdiaz@penguin.digital | Networking Technician | **Contributor** — features asignadas | *(pendiente cuenta GitHub)* | Write |

---

## 5. Repositorio GitHub

| Campo | Valor |
|-------|-------|
| Repositorio | `Alexfernan98/TechOps_Penguin_Infrastructure` |
| Visibilidad | Privado ✅ |
| Branch principal | `main` (protegido ✅) |
| Branch de desarrollo | `develop` (protegido ✅) |
| Estado actual | Creado, branches protegidos configurados |
| Nota branch protection | En plan gratuito las reglas existen pero no se enforzan automáticamente — se respetan por disciplina del equipo hasta migrar a GitHub Team si es necesario |

### Estrategia de branches

```
main          ← producción — solo Alexis mergea aquí
└── develop   ← integración — base para todo el desarrollo
    ├── feat/frontend-[nombre]
    ├── feat/backend-[nombre]
    ├── feat/integration-[nombre]
    └── fix/[descripcion]
```

---

## 6. Sistema de agentes Claude

| Agente | Responsabilidad | Cómo activar |
|--------|----------------|--------------|
| 🎨 **FRONTEND** | Componentes React, páginas, estilos, formularios, gráficas | `"Agente Frontend: [tarea]"` |
| ⚙️ **BACKEND** | API REST, lógica de negocio, Prisma, migraciones, auth, PDF, emails | `"Agente Backend: [tarea]"` |
| 🔗 **INTEGRACIÓN** | Docker Compose, Nginx, env vars, conexión FE↔BE, deploy | `"Agente Integración: [tarea]"` |

**Flujo de trabajo:**
1. Alexis describe la tarea en lenguaje humano en Claude Desktop
2. Claude escribe todo el código completo
3. Alexis (o técnico asignado) copia el código en VS Code y verifica que funcione
4. Commit + PR siguiendo la convención
5. Alexis aprueba el PR en GitHub y mergea

---

## 7. Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | React + Vite + Tailwind CSS | React 18, Vite 5 |
| Backend | Node.js + Express | Node 20 LTS |
| ORM | Prisma | Latest stable |
| Base de datos | PostgreSQL | 16 |
| Autenticación | Google OAuth2 (`passport-google-oauth20`) | — |
| Sesiones | JWT en httpOnly cookie | Access 1h + Refresh 7d |
| PDF | Puppeteer | Latest stable |
| Email | Nodemailer + SMTP Google Workspace | — |
| Contenedores | Docker + Docker Compose | — |
| Proxy reverso | Nginx | — |
| Estado global FE | Zustand | — |
| Control de versiones | Git + GitHub privado | — |

---

## 8. Entorno de desarrollo local (MacBook Air M2)

| Campo | Valor |
|-------|-------|
| Hardware | MacBook Air M2 |
| SO | macOS Sequoia 15.5 |
| Arquitectura | ARM64 (Apple Silicon) |
| Docker | Docker Desktop for Mac — imagen `arm64` |
| Editor | Visual Studio Code + extensión Claude |
| Acceso a la app | `http://localhost:3000` (frontend) · `http://localhost:4000` (backend) |
| BD local | PostgreSQL en contenedor Docker |

> ⚠️ Las imágenes Docker deben ser `linux/arm64` o `linux/amd64` con Rosetta. PostgreSQL 16, Node 20 y Nginx tienen soporte oficial ARM64.

---

## 9. Inventario actual — análisis del CSV

**Archivo:** `inventario_penguin.csv` — 55 activos, Sede Hernandarias

### Columnas del CSV (fuente de verdad para el schema)

| Columna CSV | Campo en BD | Notas |
|-------------|------------|-------|
| ID | `tag` | Formato `PE1H-IT-[TIPO]-[NNN]` — ya definido por Alexis, se respeta |
| Tipo de activo | `categorySlug` | Ver tabla de categorías abajo |
| Marca | `brand` | |
| Modelo | `model` | |
| Serial Number | `serialNumber` | Único, nullable (periféricos sin SN) |
| IMEI | `imei` | Solo para celulares/tablets |
| MAC Address WiFi | `macWifi` | |
| MAC Address Ethernet | `macEth` | |
| Sistema Operativo | `operatingSystem` | |
| Estado | `status` | Ver tabla de estados |
| Usuario actual | `assignedToName` | Texto libre en CSV — en la app es FK a User |
| Email usuario | `assignedToEmail` | Para vincular al usuario del sistema |
| Departamento | `departmentSlug` | Ver tabla de departamentos |
| Ubicacion | `locationSlug` | NOC, Networking, Mining Ops., MSU |
| Detalles | `details` | Descripción libre del activo |
| Fecha de compra | `purchaseDate` | |
| Proveedor | `vendor` | |
| Garantia hasta | `warrantyUntil` | Alerta automática a < 90 días |
| Condicion actual | `condition` | Bueno / Regular / Dañado |
| Accesorios incluidos | `accessories` | Texto libre |
| Carpeta de evidencia | `evidenceFolderUrl` | Link a Google Drive |
| Ultima revision | `lastRevisionDate` | |
| Observacion | `notes` | |

### Categorías identificadas en el CSV

| Tipo en CSV | Slug en BD | Prefijo TAG | Cantidad actual |
|-------------|-----------|-------------|-----------------|
| PC | `desktop` | PE1H-IT-PC- | 11 |
| Monitor | `monitor` | PE1H-IT-MON- | 23 |
| Notebook | `notebook` | PE1H-IT-NB- | 8 |
| Mouse | `mouse` | PE1H-IT-MOU- | 6 |
| Teclado | `keyboard` | PE1H-IT-TEC- | 5 |
| Impresora | `printer` | PE1H-IT-IMP- | 2 |

> Formato de TAG adoptado del CSV real: `[SEDE]-IT-[TIPO]-[NNN]`
> Sede Hernandarias = `PE1H` · Asunción = `PE1A` *(a confirmar)* · Central = `PE1C` *(a confirmar)*

### Estados identificados en el CSV

| Estado en CSV | Enum en BD |
|---------------|-----------|
| Asignado | `ASSIGNED` |
| Disponible | `AVAILABLE` |
| En baja | `RETIRED` |

### Ubicaciones identificadas

`NOC` · `Networking` · `Mining Ops.` · `MSU`

---

## 10. Schema de base de datos (Prisma)

> Estado: 🟡 DISEÑADO — listo para implementar en Fase 0

```prisma
// Enums
enum Role {
  SUPER_ADMIN
  IT_ADMIN
  IT_TECH
  EMPLOYEE
  READ_ONLY
}

enum AssetStatus {
  AVAILABLE
  ASSIGNED
  LOAN
  REPAIR
  DAMAGED
  RETIRED
  LOST
}

enum AssetCondition {
  GOOD       // Bueno
  FAIR       // Regular
  DAMAGED    // Dañado
}

enum TicketStatus {
  OPEN
  ASSIGNED
  IN_PROGRESS
  PENDING_USER
  RESOLVED
  CLOSED
  REOPENED
  CANCELLED
}

enum TicketPriority {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}

enum TicketCategory {
  TECH_SUPPORT
  EQUIPMENT_REQUEST
  ACCESS_PERMISSIONS
  CONNECTIVITY
  SOFTWARE
  SECURITY
  OTHER
}

enum ActaType {
  DELIVERY    // Acta de entrega
  RETURN      // Acta de devolución
  RETIREMENT  // Acta de baja
}

// Modelos principales
model User { ... }
model Location { ... }          // NOC, Networking, Mining Ops., MSU
model Department { ... }        // Mining Ops., Mantenimiento, etc.
model AssetCategory { ... }     // PC, Monitor, Notebook, etc.
model Asset { ... }             // Activo tecnológico
model AssetAssignment { ... }   // Historial de asignaciones
model Acta { ... }              // Actas de entrega/devolución/baja
model Ticket { ... }
model TicketComment { ... }
model CsatResponse { ... }
model AuditLog { ... }
model Notification { ... }
```

---

## 11. Módulo IT — Tickets

### SLAs

| Prioridad | Respuesta | Resolución |
|-----------|-----------|------------|
| `CRITICAL` | 15 min | 2 horas |
| `HIGH` | 1 hora | 4 horas |
| `MEDIUM` | 4 horas | 24 horas |
| `LOW` | 1 día hábil | 5 días hábiles |

### Numeración: `TK-YYYY-XXXX`

---

## 12. Actas — Plantilla oficial Penguin

PDF generado por Puppeteer replicando el documento real de la empresa.

**Acta de Entrega:**
- Encabezado: logo + "Penguin Infrastructure S.A." + dirección
- Título: "ACTA DE ENTREGA DE EQUIPO INFORMÁTICO"
- Párrafo: nombre empleado, CI, fecha, declaración de recepción en buen estado
- Tabla técnica: Fabricante · Modelo · SN · MAC WiFi · MAC Eth · CPU · RAM · GPU
- 6 cláusulas de responsabilidad
- Firmas: empleado receptor + Alexis Fernandez (Networking & Cybersecurity Leader)
- Fecha de entrega · Párrafo de vigencia · Version History · Footer

**Acta de Devolución agrega:** referencia al acta de entrega original, estado comparativo, días de uso, observaciones de daños, decisión IT.

---

## 13. Dashboard — KPIs

| KPI | Visual |
|-----|--------|
| Total activos por estado | Tarjetas + donut chart |
| Activos disponibles en stock | Contador + lista |
| Garantías por vencer < 90 días | Alerta + tabla |
| Tickets abiertos por prioridad | Barras apiladas |
| Tiempo promedio resolución | Línea de tiempo |
| Volumen de tickets por mes | Gráfica de línea |
| Activos por departamento/sede | Barras horizontales |
| Bajas últimos 12 meses | Área acumulada |
| % SLA cumplido | Gauge circular |

---

## 14. Plan de fases

### ✅ Pre-requisitos — COMPLETADOS

| # | Tarea | Estado |
|---|-------|--------|
| 1 | Google Sheets exportado y analizado (55 activos, 23 columnas) | ✅ LISTO |
| 2 | Repo GitHub creado: `Alexfernan98/TechOps_Penguin_Infrastructure` | ✅ LISTO |
| 3 | Branches `main` y `develop` creados y protegidos | ✅ LISTO |
| 4 | SO desarrollo: macOS Sequoia 15.5 / M2 (Docker Desktop ARM64) | ✅ LISTO |
| 5 | SO producción futuro: Ubuntu Server 24.04 | ✅ LISTO |
| 6 | Dominio: por IP local en Fase 1 | ✅ DECIDIDO |
| 7 | Estructura organizacional mapeada | ✅ LISTO |
| 8 | Emails del equipo confirmados | ✅ LISTO |
| 9 | Schema de BD diseñado en base al CSV real | ✅ LISTO |

---

### 🔴 Fase 0 — Infraestructura base
**Objetivo:** Proyecto corriendo localmente en el Mac de Alexis, con login Google funcionando y layout base visible.
**Responsable:** Alexis + Claude (Claude escribe todo el código)
**Agente principal:** Integración → Backend → Frontend

**Entregables:**
- [ ] Clonar repo y crear estructura de carpetas completa
- [ ] `docker-compose.yml` para Mac M2 (ARM64): postgres + backend + frontend + nginx
- [ ] `.env.example` con todas las variables
- [ ] Schema Prisma completo basado en el CSV real
- [ ] Primera migración aplicada — BD funciona
- [ ] Google OAuth2 configurado — login con @penguin.digital funciona
- [ ] Middleware de roles implementado
- [ ] Layout base: sidebar con módulos, header con avatar del usuario logueado
- [ ] Seed inicial: usuarios del equipo IT + 55 activos del CSV importados
- [ ] CI básico en GitHub Actions (lint + build)

**Estado:** 🔴 PENDIENTE — **PRÓXIMA ACCIÓN**
**Tiempo estimado:** 1–2 semanas

---

### 🔴 Fase 1 — Inventario y Alta de activos
**Estado:** 🔴 PENDIENTE · Depende de: Fase 0

### 🔴 Fase 2 — Actas de entrega y devolución
**Estado:** 🔴 PENDIENTE · Depende de: Fase 1

### 🔴 Fase 3 — Sistema de Tickets
**Estado:** 🔴 PENDIENTE · Puede correr en paralelo con Fase 2

### 🔴 Fase 4 — Dashboard y Analytics
**Estado:** 🔴 PENDIENTE · Depende de: Fase 1 + Fase 3

### 🔴 Fase 5 — Notificaciones y deploy final
**Estado:** 🔴 PENDIENTE · Depende de: Fases 1–4

### 🔵 Backlog — Módulos futuros
NOC · Ciberseguridad · Networking · Acceso externo · App móvil

---

## 15. Decisiones técnicas registradas

| # | Decisión | Motivo | Aprobado por |
|---|----------|--------|--------------|
| 1 | PostgreSQL 16 | Full-text search, soporte JSON, integración Prisma superior | Alexis |
| 2 | Prisma ORM | Migraciones controladas, sin DBA dedicado | Alexis |
| 3 | Puppeteer para PDF | Replica exactamente el HTML/CSS del acta oficial | Alexis |
| 4 | Sin borrado físico | Política de retención 1 año + auditoría inmutable | Alexis |
| 5 | Google OAuth2 exclusivo @penguin.digital | Sin contraseñas locales | Alexis |
| 6 | On-premise sin internet Fase 1 | Decisión de seguridad operativa | Alexis |
| 7 | Networking fuera de Fase 1 | Evitar complejidad prematura | Alexis |
| 8 | Tres agentes Claude especializados | Separación de responsabilidades por capa | Alexis |
| 9 | GitHub branch protection | Control de cambios — nada llega a main sin revisión de Alexis | Alexis |
| 10 | Zustand para estado global FE | Más simple que Redux, suficiente para el scope | Alexis |
| 11 | TAG format `PE1H-IT-[TIPO]-[NNN]` | Adoptado del inventario real existente en el CSV | Alexis |
| 12 | Docker Desktop ARM64 para desarrollo | MacBook Air M2 — imágenes nativas Apple Silicon | Alexis |
| 13 | Acceso por IP local en Fase 1 | Simplifica el arranque, dominio interno en Fase 5 | Alexis |
| 14 | Claude escribe todo el código | Alexis describe en lenguaje humano, Claude implementa | Alexis |

---

## 16. Variables de entorno requeridas

```env
# Base de datos
DATABASE_URL=postgresql://techops:password@localhost:5432/techopshub

# Google OAuth2 (obtener en console.cloud.google.com)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback
ALLOWED_DOMAIN=penguin.digital

# JWT
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Email SMTP Google Workspace
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alexis.fernandez@penguin.digital
SMTP_PASS=

# App
NODE_ENV=development
BACKEND_PORT=4000
FRONTEND_URL=http://localhost:3000

# Storage
UPLOAD_PATH=./uploads
MAX_FILE_SIZE_MB=10
```

---

*Documento de verdad única del proyecto. Actualizar el estado de cada fase a medida que avanza.*
