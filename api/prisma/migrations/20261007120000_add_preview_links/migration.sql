-- CreateTable
CREATE TABLE "preview_links" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preview_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "preview_links_content_id_key" ON "preview_links"("content_id");

-- CreateIndex
CREATE UNIQUE INDEX "preview_links_token_key" ON "preview_links"("token");

-- AddForeignKey
ALTER TABLE "preview_links" ADD CONSTRAINT "preview_links_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preview_links" ADD CONSTRAINT "preview_links_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
