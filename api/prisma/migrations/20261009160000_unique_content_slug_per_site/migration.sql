-- A slug is unique across one site, pages and entries together (CNT-04).
CREATE UNIQUE INDEX "content_site_id_slug_key" ON "content"("site_id", "slug");
