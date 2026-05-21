import type { ProviderStatus } from '../../generated/prisma/index.js';

/** Matches legacy `DoctorPanelActor` (panel-classify.ts). */
export type DoctorPanelActorBase = {
  userId: string;
  doctorProfileId: string;
  email: string;
  displayName: string | null;
};

/** Matches legacy `TechnicianPanelActor`. */
export type TechnicianPanelActorBase = {
  userId: string;
  aiTechnicianProfileId: string;
  email: string;
  displayName: string | null;
};

export type DoctorPanelMeUser = {
  id: string;
  email: string;
  displayName: string | null;
  doctorProfileId: string;
  role: 'DOCTOR';
  providerStatus: ProviderStatus;
};

export type TechnicianPanelMeUser = {
  id: string;
  email: string;
  displayName: string | null;
  aiTechnicianProfileId: string;
  role: 'AI_TECHNICIAN';
  providerStatus: ProviderStatus;
};

export type DoctorPanelActorWithProfile = DoctorPanelActorBase & {
  providerStatus: ProviderStatus;
};

export type TechnicianPanelActorWithProfile = TechnicianPanelActorBase & {
  providerStatus: ProviderStatus;
};

export function toDoctorMeUser(actor: DoctorPanelActorWithProfile): DoctorPanelMeUser {
  return {
    id: actor.userId,
    email: actor.email,
    displayName: actor.displayName,
    doctorProfileId: actor.doctorProfileId,
    role: 'DOCTOR',
    providerStatus: actor.providerStatus,
  };
}

export function toTechnicianMeUser(actor: TechnicianPanelActorWithProfile): TechnicianPanelMeUser {
  return {
    id: actor.userId,
    email: actor.email,
    displayName: actor.displayName,
    aiTechnicianProfileId: actor.aiTechnicianProfileId,
    role: 'AI_TECHNICIAN',
    providerStatus: actor.providerStatus,
  };
}
