-- Free Zone: public comment thread on free questions + reports
CREATE TABLE "FreeQuestionComment" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "authorRole" VARCHAR(16) NOT NULL,
  "body" VARCHAR(1000) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'VISIBLE',
  "hiddenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FreeQuestionComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FreeQuestionComment_requestId_createdAt_idx" ON "FreeQuestionComment"("requestId", "createdAt");
CREATE INDEX "FreeQuestionComment_status_idx" ON "FreeQuestionComment"("status");

CREATE TABLE "FreeQuestionCommentReport" (
  "id" TEXT NOT NULL,
  "commentId" TEXT NOT NULL,
  "reporterUserId" TEXT NOT NULL,
  "reason" VARCHAR(300),
  "status" VARCHAR(16) NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "FreeQuestionCommentReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FreeQuestionCommentReport_commentId_reporterUserId_key" ON "FreeQuestionCommentReport"("commentId", "reporterUserId");
CREATE INDEX "FreeQuestionCommentReport_status_createdAt_idx" ON "FreeQuestionCommentReport"("status", "createdAt");
ALTER TABLE "FreeQuestionCommentReport" ADD CONSTRAINT "FreeQuestionCommentReport_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "FreeQuestionComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
