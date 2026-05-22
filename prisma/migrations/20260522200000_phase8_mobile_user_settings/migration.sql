-- CreateEnum
CREATE TYPE "MobileThemePreference" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- CreateTable
CREATE TABLE "MobileUserSettings" (
    "userId" TEXT NOT NULL,
    "theme" "MobileThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "locale" TEXT DEFAULT 'bn-BD',
    "privacyAcceptedVersion" TEXT,
    "privacyAcceptedAt" TIMESTAMP(3),
    "termsAcceptedVersion" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileUserSettings_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "MobileUserSettings" ADD CONSTRAINT "MobileUserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
