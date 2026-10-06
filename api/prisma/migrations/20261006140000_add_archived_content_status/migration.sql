-- AlterEnum
-- On its own migration: Postgres refuses to use a newly added enum value in
-- the same transaction that added it, so the backfill is the next migration.
ALTER TYPE "content_status" ADD VALUE 'archived';
