-- Customer profile / cover images (mobile uploads).

ALTER TYPE "MobileUploadPurpose" ADD VALUE 'CUSTOMER_PROFILE_PHOTO';
ALTER TYPE "MobileUploadPurpose" ADD VALUE 'CUSTOMER_COVER_IMAGE';

ALTER TABLE "CustomerProfile" ADD COLUMN "profilePhotoUrl" TEXT;
ALTER TABLE "CustomerProfile" ADD COLUMN "coverPhotoUrl" TEXT;
