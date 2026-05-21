/** Supported login channels for orchestration (extensible). */
export type LoginMethod = 'mobile_otp' | 'email' | 'social';

export type SocialProvider = 'google' | 'apple' | 'facebook';

export type IdentityRoleSlug =
  | 'farmer'
  | 'doctor'
  | 'ai_technician'
  | 'admin'
  | 'super_admin'
  | 'support';

export type LoginCapability = {
  method: LoginMethod;
  available: boolean;
  channels: string[];
  notes?: string;
};

export type IdentityCapabilitiesDto = {
  loginMethods: LoginCapability[];
  supportedLocales: string[];
  multiDevice: boolean;
  refreshRotation: boolean;
};

export type DeviceSummaryDto = {
  id: string;
  deviceKey: string;
  platform: string | null;
  appVersion: string | null;
  lastActiveAt: string;
  hasPushToken: boolean;
};

export type ProfileSummaryDto = {
  userId: string;
  basic: {
    name: string;
    phone: string | null;
    email: string;
    locale: string;
    profileComplete: boolean;
  };
  address: {
    hasAddress: boolean;
    areaLabel: string | null;
  };
  farm: {
    animalCount: number;
    activeAnimalCount: number;
    primaryVillageId: string | null;
    primaryVillageLabelBn: string | null;
  } | null;
};

export type SessionActivityDto = {
  activeSessionCount: number;
  activeDeviceCount: number;
};
