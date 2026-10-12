-- When a revision last took a new state: an autosave inside its window overwrites the row but keeps
-- `created_at` (it anchors the window), so the History list shows this time instead (GOV-01).
ALTER TABLE "revisions" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "revisions" SET "updated_at" = "created_at";
