const router   = require('express').Router();
const passport = require('../config/passport');
const { tokensForUser, verifyRefresh } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');
const prisma = require('../../prisma/client');

// `secure: true` solo cuando el request entrante vino por HTTPS (nginx setea
// X-Forwarded-Proto). En HTTP plano queda secure:false para no romper cookies.
function cookieOpts(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  return {
    httpOnly: true,
    secure:   proto === 'https',
    sameSite: 'lax',
    path:     '/',
  };
}

// Deriva el origen público desde el request entrante (respeta X-Forwarded-* si
// está detrás de nginx). Permite que la app funcione desde cualquier host/IP
// sin reconfigurar GOOGLE_CALLBACK_URL ni FRONTEND_URL en el .env.
function publicOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host  = req.headers['x-forwarded-host']  || req.headers.host;
  return `${proto}://${host}`;
}

// ── Iniciar login con Google ──────────────────────────────────────────────────
router.get('/google', (req, res, next) => {
  passport.authenticate('google', {
    scope:       ['profile', 'email'],
    prompt:      'select_account',
    session:     false,
    callbackURL: `${publicOrigin(req)}/auth/google/callback`,
  })(req, res, next);
});

// ── Callback de Google ────────────────────────────────────────────────────────
router.get('/google/callback', (req, res, next) => {
  const origin = publicOrigin(req);
  passport.authenticate('google', {
    session: false,
    callbackURL: `${origin}/auth/google/callback`,
    failureRedirect: `${origin}/login?error=unauthorized`,
  }, (err, user) => {
    if (err || !user) return res.redirect(`${origin}/login?error=unauthorized`);
    const { accessToken, refreshToken } = tokensForUser(user);
    res.cookie('access_token',  accessToken,  { ...cookieOpts(req), maxAge: 60 * 60 * 1000 });
    res.cookie('refresh_token', refreshToken, { ...cookieOpts(req), maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.redirect(`${origin}/dashboard`);
  })(req, res, next);
});

// ── Renovar access token con refresh token ────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies?.refresh_token;
    if (!token) return res.status(401).json({ error: 'No autenticado' });

    const payload = verifyRefresh(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Usuario no válido' });
    }

    const { accessToken } = tokensForUser(user);
    res.cookie('access_token', accessToken, { ...cookieOpts(req), maxAge: 60 * 60 * 1000 });

    return res.json({ ok: true });
  } catch {
    return res.status(401).json({ error: 'Refresh token inválido o expirado' });
  }
});

// ── Datos del usuario autenticado ─────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// ── Logout ────────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  const opts = cookieOpts(req);
  res.clearCookie('access_token',  { path: '/', secure: opts.secure, sameSite: opts.sameSite });
  res.clearCookie('refresh_token', { path: '/', secure: opts.secure, sameSite: opts.sameSite });
  res.json({ ok: true });
});

module.exports = router;
