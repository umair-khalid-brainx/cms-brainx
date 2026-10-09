-- TYP-03: when a page or entry was first published. Already-live rows take their last-edited time.
ALTER TABLE "content" ADD COLUMN "published_at" TIMESTAMP(3);
UPDATE "content" SET "published_at" = "updated_at" WHERE "status" = 'published';
