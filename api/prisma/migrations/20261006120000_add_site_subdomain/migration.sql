-- AlterTable
-- Added nullable first so existing sites can be backfilled before NOT NULL
-- applies: each existing site takes the first label of its host
-- (`corrick.yourcms.com` -> `corrick`). See DECISIONS.md D-030.
ALTER TABLE "sites" ADD COLUMN "subdomain" TEXT;

UPDATE "sites" SET "subdomain" = lower(split_part("host", '.', 1));

ALTER TABLE "sites" ALTER COLUMN "subdomain" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "sites_subdomain_key" ON "sites"("subdomain");
