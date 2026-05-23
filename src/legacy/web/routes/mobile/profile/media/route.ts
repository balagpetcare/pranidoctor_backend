import { postCustomerProfileMediaBatch } from '@/lib/mobile-api/customer-profile-media-upload';

export const runtime = 'nodejs';

/** POST multipart: profile_image, cover_image (optional either). */
export async function POST(request: Request) {
  return postCustomerProfileMediaBatch(request);
}
