-- MED-04: alternative text, title and description for library files.
ALTER TABLE "media" ADD COLUMN "alt" TEXT,
ADD COLUMN "title" TEXT,
ADD COLUMN "description" TEXT;
