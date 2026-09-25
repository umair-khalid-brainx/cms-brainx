-- CreateEnum
CREATE TYPE "member_role" AS ENUM ('owner', 'administrator', 'editor', 'author', 'contributor');

-- AlterTable
-- Manually rewritten from Prisma's auto-generated drop+recreate (which
-- Prisma itself refused to run because the column has data): casts the
-- existing text values straight to the new enum instead of losing them.
-- Every current value ('owner', from the seed) matches an enum member.
ALTER TABLE "site_memberships"
  ALTER COLUMN "role" TYPE "member_role" USING ("role"::"member_role");

-- CreateTable
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "member_role" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "invited_by_user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invites_token_hash_key" ON "invites"("token_hash");

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
