-- AlterTable: barcode opcional, único parcial (un activo puede tenerlo o no)
ALTER TABLE "assets" ADD COLUMN "barcode" TEXT;
CREATE UNIQUE INDEX "assets_barcode_key" ON "assets"("barcode") WHERE "barcode" IS NOT NULL;
