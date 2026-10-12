-- Tagline, footer note and logo of a site's public header and footer (GOV-04).
-- AlterTable
ALTER TABLE "sites" ADD COLUMN     "settings" JSONB NOT NULL DEFAULT '{}';

