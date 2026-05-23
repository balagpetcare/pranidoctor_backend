import {
  deleteCustomerProfileMedia,
  postCustomerProfileMedia,
} from '@/lib/mobile-api/customer-profile-media-upload';

/** POST multipart field `cover` — upload profile cover. */
export async function POST(request: Request) {
  return postCustomerProfileMedia(request, 'cover');
}

/** DELETE — remove profile cover. */
export async function DELETE(request: Request) {
  return deleteCustomerProfileMedia(request, 'cover');
}
