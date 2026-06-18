-- Soporte para activos compartidos entre múltiples usuarios (ej. PCs del NOC).
ALTER TABLE "assets" ADD COLUMN "shared" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "asset_assignments" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT true;
