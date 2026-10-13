-- Custom domains (DEP-02, D-066): `host` is optional, with a status shown on the Domains screen.
-- CreateEnum
CREATE TYPE "domain_status" AS ENUM ('pending', 'verified');

-- AlterTable
ALTER TABLE "sites" ADD COLUMN     "domain_status" "domain_status",
ALTER COLUMN "host" DROP NOT NULL;

-- The seed's placeholder hosts (`corrick.yourcms.com`) were never real domains: clear them, so a site's custom
-- domain is only ever one its owner added (DEP-02).
UPDATE "sites" SET "host" = NULL WHERE "host" LIKE '%.yourcms.com';
-- Any real host already there is a domain nobody has confirmed yet: pending, so a domain never has no status.
UPDATE "sites" SET "domain_status" = 'pending' WHERE "host" IS NOT NULL AND "domain_status" IS NULL;
