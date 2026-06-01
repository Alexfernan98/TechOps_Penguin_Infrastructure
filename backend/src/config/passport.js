const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const prisma = require('../../prisma/client');

passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value ?? '';
        const allowedDomain = process.env.ALLOWED_DOMAIN || 'penguin.digital';

        if (!email.endsWith(`@${allowedDomain}`)) {
          return done(null, false, {
            message: `Acceso restringido a cuentas @${allowedDomain}`,
          });
        }

        let user = await prisma.user.findUnique({ where: { googleId: profile.id } });

        if (!user) {
          // Primer login — crear usuario con rol EMPLOYEE por defecto
          user = await prisma.user.create({
            data: {
              googleId:  profile.id,
              email,
              name:      profile.displayName,
              avatarUrl: profile.photos?.[0]?.value ?? null,
              role:      'EMPLOYEE',
            },
          });
        } else {
          // Actualizar avatar y fecha de último login
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              avatarUrl:   profile.photos?.[0]?.value ?? user.avatarUrl,
              lastLoginAt: new Date(),
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
