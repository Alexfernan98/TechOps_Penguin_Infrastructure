-- Sprint 1a: Networking + CCTV + Servers como categorías de Asset.
-- Agrega columnas opcionales en assets y seedea las nuevas categorías.
-- Nota: el firewall cubre también routing (Fortigate) — no hay categoría "router" aparte.

ALTER TABLE "assets" ADD COLUMN "ipManagement"    TEXT;
ALTER TABLE "assets" ADD COLUMN "internalCode"    TEXT;
ALTER TABLE "assets" ADD COLUMN "nvrChannel"      TEXT;
ALTER TABLE "assets" ADD COLUMN "cameraType"      TEXT;
ALTER TABLE "assets" ADD COLUMN "megapixels"      INTEGER;
ALTER TABLE "assets" ADD COLUMN "ports"           INTEGER;
ALTER TABLE "assets" ADD COLUMN "role"            TEXT;
ALTER TABLE "assets" ADD COLUMN "haMode"          TEXT;
ALTER TABLE "assets" ADD COLUMN "haPeerAssetId"   TEXT;
ALTER TABLE "assets" ADD COLUMN "displayLocation" TEXT;

-- Categorías nuevas (idempotente vía ON CONFLICT). ID = slug para simplificar.
-- Columnas reales de asset_categories: id, slug, name, tagPrefix, icon, isActive, createdAt.
INSERT INTO "asset_categories" ("id", "slug", "name", "tagPrefix", "icon", "isActive", "createdAt") VALUES
  ('switch',   'switch',   'Switch',   'PE1H-NET-SW-',  'Network',     true, NOW()),
  ('firewall', 'firewall', 'Firewall', 'PE1H-NET-FW-',  'ShieldCheck', true, NOW()),
  ('ap',       'ap',       'AP Wi-Fi', 'PE1H-NET-AP-',  'Wifi',        true, NOW()),
  ('camera',   'camera',   'Cámara',   'PE1H-CCTV-CAM-','Video',       true, NOW()),
  ('server',   'server',   'Servidor', 'PE1H-IT-SRV-',  'Server',      true, NOW()),
  ('ups',      'ups',      'UPS',      'PE1H-IT-UPS-',  'BatteryFull', true, NOW()),
  ('rack',     'rack',     'Rack',     'PE1H-IT-RACK-', 'Archive',     true, NOW())
ON CONFLICT ("slug") DO NOTHING;
