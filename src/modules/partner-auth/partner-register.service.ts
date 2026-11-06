import { AiTechnicianStatus, ProviderStatus } from '../../generated/prisma/index.js';
import { registerCustomerWithPassword } from '../../legacy/web/lib/mobile-auth/customer-credentials-service.js';
import { getPrisma } from '../../shared/database/prisma.js';

import type { PartnerRole } from './partner-roles.js';

export type PartnerRegisterInput = {
  name: string;
  mobile: string;
  email: string;
  password: string;
  /** Optional — normally partners register as plain users and apply for a role later. */
  primaryRole?: PartnerRole | undefined;
};

export type PartnerRegisterResult =
  | { ok: true; userId: string; profileCreated: boolean }
  | { ok: false; httpStatus: number; code: string; message: string };

/**
 * Creates a normal (CUSTOMER) account — so existing mobile auth keeps working and the same
 * login also works in the farmer app — then attaches the PRIMARY partner profile in a pending state.
 * Verification documents, BVC number, areas and fees are collected afterwards in the app.
 */
export async function registerPartner(input: PartnerRegisterInput): Promise<PartnerRegisterResult> {
  const created = await registerCustomerWithPassword({
    name: input.name,
    rawMobile: input.mobile,
    rawEmail: input.email,
    password: input.password,
  });
  if (!created.ok) {
    return { ok: false, httpStatus: created.httpStatus, code: created.code, message: created.message };
  }

  const userId = created.userId;
  if (!input.primaryRole) return { ok: true, userId, profileCreated: false };

  const prisma = getPrisma();
  const displayName = input.name.trim();
  try {
    switch (input.primaryRole) {
      case 'DOCTOR':
        // licenseNumber (BVC) is required by the schema; it is filled during verification.
        await prisma.doctorProfile.create({
          data: {
            userId,
            licenseNumber: '',
            displayName,
            providerStatus: ProviderStatus.PENDING_VERIFICATION,
          },
        });
        break;
      case 'AI_TECHNICIAN':
        await prisma.aiTechnicianProfile.create({
          data: {
            userId,
            displayName,
            status: AiTechnicianStatus.DRAFT,
            providerStatus: ProviderStatus.PENDING_VERIFICATION,
          },
        });
        break;
      case 'HEALTH_WORKER':
        await prisma.healthWorkerProfile.create({
          data: { userId, displayName, providerStatus: ProviderStatus.PENDING_VERIFICATION },
        });
        break;
    }
    return { ok: true, userId, profileCreated: true };
  } catch (e) {
    // The account exists; the app can offer "apply again" because accountState will be NOT_APPLIED.
    console.error('[partner-register] profile creation failed', e);
    return { ok: true, userId, profileCreated: false };
  }
}
