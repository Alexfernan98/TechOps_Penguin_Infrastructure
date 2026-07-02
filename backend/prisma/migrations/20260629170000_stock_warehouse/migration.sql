-- Sprint 1b — Almacén / Stock: grupos gestionables, ítems con cantidad y bitácora de movimientos.

CREATE TABLE "stock_groups" (
  "id"        TEXT NOT NULL,
  "slug"      TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_groups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "stock_groups_slug_key" ON "stock_groups"("slug");

CREATE TABLE "stock_items" (
  "id"           TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "groupSlug"    TEXT NOT NULL,
  "categorySlug" TEXT,
  "brand"        TEXT,
  "model"        TEXT,
  "unit"         TEXT NOT NULL DEFAULT 'unidad',
  "quantity"     INTEGER NOT NULL DEFAULT 0,
  "minQuantity"  INTEGER,
  "location"     TEXT,
  "notes"        TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  "deletedAt"    TIMESTAMP(3),
  CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_items_groupSlug_idx"    ON "stock_items"("groupSlug");
CREATE INDEX "stock_items_categorySlug_idx" ON "stock_items"("categorySlug");
CREATE INDEX "stock_items_deletedAt_idx"    ON "stock_items"("deletedAt");

CREATE TABLE "stock_movements" (
  "id"          TEXT NOT NULL,
  "stockItemId" TEXT NOT NULL,
  "delta"       INTEGER NOT NULL,
  "reason"      TEXT NOT NULL,
  "assetId"     TEXT,
  "userId"      TEXT,
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_movements_stockItemId_idx" ON "stock_movements"("stockItemId");

ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_groupSlug_fkey"
  FOREIGN KEY ("groupSlug") REFERENCES "stock_groups"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stockItemId_fkey"
  FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grupos iniciales (editables/eliminables desde la app).
INSERT INTO "stock_groups" ("id", "slug", "name", "sortOrder") VALUES
  ('grp_networking',  'networking',    'Networking',       1),
  ('grp_fibra',       'fibra_optica',  'Fibra Óptica',     2),
  ('grp_cctv',        'cctv',          'CCTV',             3),
  ('grp_energia',     'energia',       'Energía',          4),
  ('grp_herramientas','herramientas',  'Herramientas',     5),
  ('grp_consumibles', 'consumibles',   'Consumibles',      6),
  ('grp_varios',      'varios',        'Varios',           7)
ON CONFLICT ("slug") DO NOTHING;
