-- TYP-01: custom content types, and which type (and author) an entry belongs to.
CREATE TABLE "content_types" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "singular_name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "is_built_in" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "content_types_site_id_prefix_key" ON "content_types"("site_id", "prefix");

ALTER TABLE "content_types" ADD CONSTRAINT "content_types_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "content" ADD COLUMN "type_id" TEXT,
ADD COLUMN "author_id" TEXT;

ALTER TABLE "content" ADD CONSTRAINT "content_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "content_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "content" ADD CONSTRAINT "content_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Every existing site gets the built-in "Posts" type at /blog, unless a page of
-- its own already sits at that address (it would clash with the type's listing).
INSERT INTO "content_types" ("id", "site_id", "name", "singular_name", "prefix", "is_built_in", "updated_at")
SELECT 'ct_' || replace(gen_random_uuid()::text, '-', ''), s."id", 'Posts', 'Post', 'blog', true, CURRENT_TIMESTAMP
FROM "sites" s
WHERE NOT EXISTS (
    SELECT 1 FROM "content" c
    WHERE c."site_id" = s."id" AND (c."path" = '/blog' OR c."path" LIKE '/blog/%')
);
