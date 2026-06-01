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

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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
app.use('/auth', require('./routes/auth'));
// app.use('/api/users',   require('./routes/users'));
// app.use('/api/assets',  require('./routes/assets'));
// app.use('/api/tickets', require('./routes/tickets'));

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
});

module.exports = app;
