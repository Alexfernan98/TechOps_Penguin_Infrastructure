-- AlterTable: agregar notifPrefs (JSON) a users — opt-out por tipo de notificación
ALTER TABLE "users" ADD COLUMN "notifPrefs" JSONB;
