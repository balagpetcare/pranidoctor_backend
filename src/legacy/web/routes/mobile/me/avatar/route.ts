import {
  deleteCustomerProfileMedia,
  postCustomerProfileMedia,
} from '@/lib/mobile-api/customer-profile-media-upload';

/** POST multipart field `avatar` — upload profile avatar. */
export async function POST(request: Request) {
  return postCustomerProfileMedia(request, 'avatar');
}

/** DELETE — remove profile avatar. */
export async function DELETE(request: Request) {
  return deleteCustomerProfileMedia(request, 'avatar');
}
