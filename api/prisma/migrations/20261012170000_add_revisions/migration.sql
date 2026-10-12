-- Revisions of pages and entries (GOV-01).
-- CreateEnum
CREATE TYPE "revision_reason" AS ENUM ('publish', 'status', 'restore', 'autosave', 'before_restore');

-- CreateTable
CREATE TABLE "revisions" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "blocks" JSONB NOT NULL,
    "data" JSONB NOT NULL,
    "seo" JSONB NOT NULL,
    "terms" JSONB NOT NULL DEFAULT '[]',
    "status" "content_status" NOT NULL,
    "reason" "revision_reason" NOT NULL,
    "author_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "revisions_content_id_created_at_idx" ON "revisions"("content_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "revisions_site_id_idx" ON "revisions"("site_id");

-- AddForeignKey
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
