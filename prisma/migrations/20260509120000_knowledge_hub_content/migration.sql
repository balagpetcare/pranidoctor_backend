-- Knowledge Hub: ContentCategory + ContentPost editorial workflow (replaces ContentStatus on posts).

-- CreateEnum
CREATE TYPE "ContentApprovalStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ContentCategory" (
    "id" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "nameEn" TEXT,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentCategory_slug_key" ON "ContentCategory"("slug");
CREATE INDEX "ContentCategory_isActive_sortOrder_idx" ON "ContentCategory"("isActive", "sortOrder");

-- Legacy posts: assign a stable “uncategorized” row before FK + NOT NULL.
INSERT INTO "ContentCategory" ("id", "nameBn", "nameEn", "slug", "description", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES ('cmigrationhub00000001', 'অশ্রেণীকৃত', 'Uncategorized', 'uncategorized', 'Backfill for existing ContentPost rows', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable ContentPost
ALTER TABLE "ContentPost" ADD COLUMN "summary" TEXT,
ADD COLUMN "coverImageUrl" TEXT,
ADD COLUMN "categoryId" TEXT,
ADD COLUMN "approvalStatus" "ContentApprovalStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "rejectionReason" TEXT,
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ContentPost" SET
  "approvalStatus" = CASE "status"::text
    WHEN 'PUBLISHED' THEN 'APPROVED'::"ContentApprovalStatus"
    WHEN 'ARCHIVED' THEN 'APPROVED'::"ContentApprovalStatus"
    ELSE 'DRAFT'::"ContentApprovalStatus"
  END,
  "isPublished" = ("status"::text = 'PUBLISHED'),
  "publishedAt" = CASE WHEN "status"::text = 'PUBLISHED' THEN "updatedAt" ELSE NULL END,
  "categoryId" = 'cmigrationhub00000001',
  "coverImageUrl" = "imageUrl";

ALTER TABLE "ContentPost" ALTER COLUMN "categoryId" SET NOT NULL;

ALTER TABLE "ContentPost" ADD CONSTRAINT "ContentPost_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ContentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "ContentPost_status_idx";

ALTER TABLE "ContentPost" DROP COLUMN "category",
DROP COLUMN "animalType",
DROP COLUMN "videoUrl",
DROP COLUMN "imageUrl",
DROP COLUMN "status";

DROP TYPE "ContentStatus";

ALTER TABLE "ContentPost" DROP CONSTRAINT "ContentPost_authorUserId_fkey";

ALTER TABLE "ContentPost" RENAME COLUMN "authorUserId" TO "authorId";

ALTER TABLE "ContentPost" ADD CONSTRAINT "ContentPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "ContentPost_authorUserId_idx";

CREATE INDEX "ContentPost_approvalStatus_idx" ON "ContentPost"("approvalStatus");
CREATE INDEX "ContentPost_authorId_idx" ON "ContentPost"("authorId");
CREATE INDEX "ContentPost_categoryId_idx" ON "ContentPost"("categoryId");
CREATE INDEX "ContentPost_isPublished_publishedAt_idx" ON "ContentPost"("isPublished", "publishedAt");
