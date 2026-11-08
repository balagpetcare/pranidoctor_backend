-- CreateTable
CREATE TABLE "ContactViolation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "field" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "kinds" TEXT[],
    "samples" TEXT[],
    "imageUrl" TEXT,
    "strikeNo" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "verificationRemoved" BOOLEAN NOT NULL DEFAULT false,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactViolation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactViolation_userId_status_idx" ON "ContactViolation"("userId", "status");
CREATE INDEX "ContactViolation_status_createdAt_idx" ON "ContactViolation"("status", "createdAt");
CREATE INDEX "ContactViolation_source_idx" ON "ContactViolation"("source");
