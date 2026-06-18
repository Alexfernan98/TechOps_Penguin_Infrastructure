-- Tokens OAuth de Google guardados por usuario para acceder a Drive en su nombre.
ALTER TABLE "users"
  ADD COLUMN "googleAccessToken"  TEXT,
  ADD COLUMN "googleRefreshToken" TEXT,
  ADD COLUMN "googleTokenExpiry"  TIMESTAMP(3);
