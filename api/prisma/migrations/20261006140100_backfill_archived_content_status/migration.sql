-- Pages archived under D-029 kept their draft/published status and only had
-- archived_at set. Under D-032 `archived` is the status itself.
UPDATE "content" SET "status" = 'archived' WHERE "archived_at" IS NOT NULL;
