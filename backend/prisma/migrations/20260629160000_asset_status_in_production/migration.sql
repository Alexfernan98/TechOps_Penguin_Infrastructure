-- Nuevo estado para infraestructura instalada y operativa (switches, cámaras,
-- APs, servidores en producción). Diferencia "en uso en el sitio" de "disponible
-- en WH". No se usa el valor en esta misma migración (Postgres lo exige).
ALTER TYPE "AssetStatus" ADD VALUE IF NOT EXISTS 'IN_PRODUCTION';
