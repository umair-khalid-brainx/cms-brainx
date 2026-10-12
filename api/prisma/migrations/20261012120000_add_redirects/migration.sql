-- Redirects per site (GOV-05): never chained, a page always wins over one.
-- CreateEnum
CREATE TYPE "redirect_source" AS ENUM ('manual', 'auto');

-- CreateTable
CREATE TABLE "redirects" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "from_path" TEXT NOT NULL,
    "to_path" TEXT NOT NULL,
    "source" "redirect_source" NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redirects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "redirects_site_id_from_path_key" ON "redirects"("site_id", "from_path");

-- AddForeignKey
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

