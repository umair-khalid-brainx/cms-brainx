-- A site's header and footer menus (GOV-03).
-- CreateEnum
CREATE TYPE "menu_location" AS ENUM ('header', 'footer');

-- CreateTable
CREATE TABLE "menu_items" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "location" "menu_location" NOT NULL,
    "parent_id" TEXT,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "content_id" TEXT,
    "url" TEXT,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "menu_items_site_id_location_parent_id_position_idx" ON "menu_items"("site_id", "location", "parent_id", "position");

-- CreateIndex
CREATE INDEX "menu_items_content_id_idx" ON "menu_items"("content_id");

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

