/**
 * Mobile customer profile — `GET` / `PATCH` `/api/mobile/me`.
 * Phase 2: thin compat adapter → `modules/profile`.
 */
import { requireMobileCustomer } from '@/lib/mobile-auth/guard';

import {
  handleMobileMeGet,
  handleMobileMePatch,
} from '../../../../../modules/profile/compat/mobile-me.adapter.js';

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  return handleMobileMeGet(request, auth.ctx.userId, auth.ctx.profileLocale);
}

export async function PATCH(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  return handleMobileMePatch(request, auth.ctx.userId, auth.ctx.profileLocale);
}
