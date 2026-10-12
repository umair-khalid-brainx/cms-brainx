-- Categories and tags (TAX-01), and which content types opt into them.
-- CreateEnum
CREATE TYPE "term_kind" AS ENUM ('category', 'tag');

-- AlterTable
ALTER TABLE "content_types" ADD COLUMN "has_categories" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "has_tags" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "terms" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "kind" "term_kind" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_terms" (
    "content_id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,

    CONSTRAINT "content_terms_pkey" PRIMARY KEY ("content_id","term_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "terms_site_id_kind_slug_key" ON "terms"("site_id", "kind", "slug");

-- CreateIndex
CREATE INDEX "content_terms_term_id_idx" ON "content_terms"("term_id");

-- AddForeignKey
ALTER TABLE "terms" ADD CONSTRAINT "terms_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_terms" ADD CONSTRAINT "content_terms_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_terms" ADD CONSTRAINT "content_terms_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The built-in Posts type of every existing site starts with both on; new types start with both off.
UPDATE "content_types" SET "has_categories" = true, "has_tags" = true WHERE "is_built_in" = true;
