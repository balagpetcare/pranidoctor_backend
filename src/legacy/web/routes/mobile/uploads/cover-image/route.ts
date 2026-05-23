import { postCustomerProfileMedia } from '@/lib/mobile-api/customer-profile-media-upload';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return postCustomerProfileMedia(request, 'cover');
}
