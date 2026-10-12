-- A page's parent page (CNT-05). Restrict: a parent can't be deleted while it has children.
-- AlterTable
ALTER TABLE "content" ADD COLUMN     "parent_id" TEXT;

-- CreateIndex
CREATE INDEX "content_site_id_parent_id_idx" ON "content"("site_id", "parent_id");

-- AddForeignKey
ALTER TABLE "content" ADD CONSTRAINT "content_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

