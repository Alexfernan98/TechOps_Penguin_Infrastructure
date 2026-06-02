-- AlterEnum: AssetCondition + POOR
ALTER TYPE "AssetCondition" ADD VALUE 'POOR' AFTER 'FAIR';

-- AlterEnum: AuditAction + DELETE_LOGICAL
ALTER TYPE "AuditAction" ADD VALUE 'DELETE_LOGICAL' AFTER 'DELETE';

-- AlterTable: users — agregar campos para invitaciones, CI, nombres separados, cuentas funcionales
ALTER TABLE "users"
  ALTER COLUMN "googleId" DROP NOT NULL,
  ADD COLUMN "nameFirst" TEXT,
  ADD COLUMN "nameLast"  TEXT,
  ADD COLUMN "ci"        TEXT,
  ADD COLUMN "generic"   BOOLEAN NOT NULL DEFAULT false;
