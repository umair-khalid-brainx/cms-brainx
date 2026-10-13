-- Review and scheduling (GOV-07) and the Viewer role. Postgres 12+ adds enum values inside a transaction.


ALTER TYPE "content_status" ADD VALUE 'in_review';
ALTER TYPE "content_status" ADD VALUE 'scheduled';

-- AlterEnum
ALTER TYPE "member_role" ADD VALUE 'viewer';

-- AlterTable
ALTER TABLE "content" ADD COLUMN     "publish_at" TIMESTAMP(3),
ADD COLUMN     "review_note" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by_id" TEXT,
ADD COLUMN     "scheduled_by_id" TEXT,
ADD COLUMN     "submitted_at" TIMESTAMP(3),
ADD COLUMN     "submitted_by_id" TEXT;

-- CreateIndex
CREATE INDEX "content_site_id_status_publish_at_idx" ON "content"("site_id", "status", "publish_at");

-- AddForeignKey
ALTER TABLE "content" ADD CONSTRAINT "content_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content" ADD CONSTRAINT "content_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content" ADD CONSTRAINT "content_scheduled_by_id_fkey" FOREIGN KEY ("scheduled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
