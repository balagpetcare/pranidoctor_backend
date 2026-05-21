-- CreateTable
CREATE TABLE "MobileOtpChallenge" (
    "id" TEXT NOT NULL,
    "normalizedPhone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifyAttempts" INTEGER NOT NULL DEFAULT 0,
    "sendWindowStartedAt" TIMESTAMP(3),
    "sendsInWindow" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MobileOtpChallenge_normalizedPhone_key" ON "MobileOtpChallenge"("normalizedPhone");

-- CreateIndex
CREATE INDEX "MobileOtpChallenge_expiresAt_idx" ON "MobileOtpChallenge"("expiresAt");
