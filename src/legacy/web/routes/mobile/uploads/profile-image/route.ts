import { MobileUploadPurpose } from "@/generated/prisma/client";
import { postCustomerImageAndSaveProfileField } from "@/lib/mobile-api/customer-profile-image-upload";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return postCustomerImageAndSaveProfileField(
    request,
    MobileUploadPurpose.CUSTOMER_PROFILE_PHOTO,
    "profilePhotoUrl",
  );
}
