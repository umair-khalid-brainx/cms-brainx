-- AlterTable
ALTER TABLE "content" ADD COLUMN "chrome" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN "preset_id" TEXT;

-- CreateTable
CREATE TABLE "chrome_presets" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "location" "menu_location" NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "logo" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "bottom_text" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chrome_presets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chrome_presets_site_id_location_name_key" ON "chrome_presets"("site_id", "location", "name");

-- CreateIndex
CREATE INDEX "menu_items_preset_id_idx" ON "menu_items"("preset_id");

-- AddForeignKey
ALTER TABLE "chrome_presets" ADD CONSTRAINT "chrome_presets_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_preset_id_fkey" FOREIGN KEY ("preset_id") REFERENCES "chrome_presets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
