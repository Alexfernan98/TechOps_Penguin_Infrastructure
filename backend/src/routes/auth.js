const router   = require('express').Router();
const passport = require('../config/passport');
const { tokensForUser, verifyRefresh } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');
const prisma = require('../../prisma/client');

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path:     '/',
};

// ── Iniciar login con Google ──────────────────────────────────────────────────
router.get('/google', passport.authenticate('google', {
  scope:  ['profile', 'email'],
  prompt: 'select_account',
  session: false,
}));

// ── Callback de Google ────────────────────────────────────────────────────────
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=unauthorized` }),
  (req, res) => {
    const { accessToken, refreshToken } = tokensForUser(req.user);

    res.cookie('access_token',  accessToken,  { ...COOKIE_OPTS, maxAge: 60 * 60 * 1000 });         // 1h
    res.cookie('refresh_token', refreshToken, { ...COOKIE_OPTS, maxAge: 7 * 24 * 60 * 60 * 1000 }); // 7d

    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  }
);

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
    res.cookie('access_token', accessToken, { ...COOKIE_OPTS, maxAge: 60 * 60 * 1000 });

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
  res.clearCookie('access_token',  { path: '/' });
  res.clearCookie('refresh_token', { path: '/' });
  res.json({ ok: true });
});

module.exports = router;
