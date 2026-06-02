require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const passport = require('./config/passport');

const app = express();
const PORT = process.env.BACKEND_PORT || 4000;

// ─────────────────────────────────────────────
// Middleware de seguridad
// ─────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
}));

// CORS: acepta localhost y cualquier IP de red local privada (RFC1918) para que
// otros equipos en la LAN puedan usar la app sin reconfigurar.
const LOCAL_NET_RE = /^https?:\/\/(localhost|127\.0\.0\.1|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})(:\d+)?$/;
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // mobile apps, curl, same-origin
    if (LOCAL_NET_RE.test(origin)) return cb(null, true);
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) return cb(null, true);
    return cb(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─────────────────────────────────────────────
// Middleware general
// ─────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─────────────────────────────────────────────
// Health check (para Docker healthcheck)
// ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'TechOpsHub API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ─────────────────────────────────────────────
// Passport (sin sesión — usamos JWT)
// ─────────────────────────────────────────────
app.use(passport.initialize());

// ─────────────────────────────────────────────
// Rutas
// ─────────────────────────────────────────────
app.use('/auth',              require('./routes/auth'));
app.use('/users',             require('./routes/users'));
app.use('/departments',       require('./routes/departments'));
app.use('/locations',         require('./routes/locations'));
app.use('/asset-categories',  require('./routes/assetCategories'));
app.use('/assets',            require('./routes/assets'));
app.use('/actas',             require('./routes/actas'));
app.use('/tickets',           require('./routes/tickets'));
app.use('/notifications',     require('./routes/notifications'));
app.use('/audit',             require('./routes/audit'));
app.use('/dashboard',         require('./routes/dashboard'));

// Archivos subidos (PDFs de actas firmadas) — servidos estáticamente
app.use('/uploads', express.static(require('path').join(__dirname, '../uploads')));

app.get('/api', (_req, res) => {
  res.json({
    message: 'TechOpsHub API v0.1.0',
    docs: 'Próximamente',
  });
});

// ─────────────────────────────────────────────
// Manejo de errores global
// ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado', path: req.path });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Error no manejado:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : err.message,
  });
});

// ─────────────────────────────────────────────
// Arrancar servidor
// ─────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 TechOpsHub API corriendo en http://localhost:${PORT}`);
  console.log(`📋 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health\n`);
  require('./services/cron').startCron();
});

module.exports = app;
