-- TYP-02: custom fields on a content type, and their values on each entry.
ALTER TABLE "content_types" ADD COLUMN "fields" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "content" ADD COLUMN "data" JSONB NOT NULL DEFAULT '{}';

-- The built-in Posts type carries an excerpt and a featured image (req. 3).
UPDATE "content_types"
SET "fields" = '[{"key":"excerpt","label":"Excerpt","kind":"text","required":false},{"key":"featured_image","label":"Featured image","kind":"media","required":false}]'::jsonb
WHERE "is_built_in" = true AND "prefix" = 'blog';
