-- Search and social-sharing settings per page and entry (SEO-01).
-- AlterTable
ALTER TABLE "content" ADD COLUMN     "seo" JSONB NOT NULL DEFAULT '{}';

