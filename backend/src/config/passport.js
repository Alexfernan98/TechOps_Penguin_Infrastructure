const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const prisma = require('../../prisma/client');

// Estrategia Google: pide profile/email + drive.file (subir/leer SUS archivos)
// + drive.readonly (listar archivos a los que tenga permiso). Los scopes Drive
// se agregan acá; passport-google-oauth20 los pasa al consent screen.
passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, params, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value ?? '';
        const allowedDomain = process.env.ALLOWED_DOMAIN || 'penguin.digital';

        if (!email.endsWith(`@${allowedDomain}`)) {
          return done(null, false, {
            message: `Acceso restringido a cuentas @${allowedDomain}`,
          });
        }

        // Calcular expiración del access token. `params.expires_in` viene en seg.
        const expiresIn = (params && typeof params.expires_in === 'number') ? params.expires_in : 3600;
        const tokenExpiry = new Date(Date.now() + expiresIn * 1000);

        // Datos comunes a guardar/actualizar en cada login.
        const tokenData = {
          googleAccessToken: accessToken || null,
          googleTokenExpiry: tokenExpiry,
          // refresh_token solo viene la PRIMERA vez (o cuando se pide prompt=consent).
          // Si no lo recibimos, preservamos el que ya teníamos.
          ...(refreshToken ? { googleRefreshToken: refreshToken } : {}),
          lastLoginAt: new Date(),
        };

        let user = await prisma.user.findFirst({ where: { googleId: profile.id } });

        if (!user) {
          const byEmail = await prisma.user.findUnique({ where: { email } });
          if (byEmail) {
            user = await prisma.user.update({
              where: { email },
              data:  {
                googleId:  profile.id,
                avatarUrl: profile.photos?.[0]?.value ?? byEmail.avatarUrl,
                ...tokenData,
              },
            });
          } else {
            user = await prisma.user.create({
              data: {
                googleId:  profile.id,
                email,
                name:      profile.displayName,
                avatarUrl: profile.photos?.[0]?.value ?? null,
                role:      'EMPLOYEE',
                ...tokenData,
              },
            });
          }
        } else {
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              avatarUrl: profile.photos?.[0]?.value ?? user.avatarUrl,
              ...tokenData,
            },
          });
        }

        if (!user.isActive) {
          return done(null, false, { message: 'Usuario desactivado. Contactá al administrador.' });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

module.exports = passport;
