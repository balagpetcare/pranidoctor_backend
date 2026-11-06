export const PROVIDER_KINDS = ['DOCTOR', 'AI_TECHNICIAN', 'HEALTH_WORKER'] as const;
export type ProviderKindName = (typeof PROVIDER_KINDS)[number];

export const SPECIES_GROUPS = ['cattle_goat', 'poultry_duck', 'pet'] as const;
export type SpeciesGroup = (typeof SPECIES_GROUPS)[number];

export const HUB_CATEGORY_KEYS = [
  'emergency_doctor',
  'cattle_goat',
  'poultry_duck',
  'pet',
  'ai_technician',
  'health_worker',
  'home_visit',
] as const;
export type HubCategoryKey = (typeof HUB_CATEGORY_KEYS)[number];

export const PROVIDER_SORTS = ['recommended', 'rating', 'fee_low', 'experience'] as const;
export type ProviderSort = (typeof PROVIDER_SORTS)[number];

/** How closely a provider's coverage matches the user's area. */
export type AreaMatch = 'EXACT' | 'NEAR' | 'DISTRICT' | 'REGION';

export interface HubCategoryDef {
  key: HubCategoryKey;
  kind: ProviderKindName;
  labelBn: string;
  labelEn: string;
  hintBn: string;
  species?: SpeciesGroup;
  emergencyOnly?: boolean;
  homeVisitOnly?: boolean;
}

export interface ProviderFilters {
  kind: ProviderKindName;
  species?: SpeciesGroup | undefined;
  emergencyOnly?: boolean | undefined;
  homeVisitOnly?: boolean | undefined;
  onlineOnly?: boolean | undefined;
}

export interface ProviderFees {
  visit: number | null;
  emergency: number | null;
  online: number | null;
  service: number | null;
}

export interface ProviderCard {
  kind: ProviderKindName;
  id: string;
  name: string;
  subtitle: string | null;
  photoUrl: string | null;
  verified: boolean;
  registrationNo: string | null;
  experienceYears: number | null;
  rating: { avg: number; count: number };
  fees: ProviderFees;
  isOnline: boolean;
  acceptsEmergency: boolean;
  acceptsOnline: boolean;
  acceptsHomeVisit: boolean;
  areaMatch: AreaMatch;
  tags: string[];
}

export interface ProviderServiceDto {
  id: string;
  title: string;
  description: string | null;
  mode: string;
  priceBdt: number;
  durationMinutes: number | null;
  species: string[];
}

export interface ProviderDetail extends ProviderCard {
  bio: string | null;
  /** Active, non-hidden services ("gigs") the provider offers. */
  services: ProviderServiceDto[];
  coverageAreas: Array<{ id: string; name: string; nameBn: string | null; type: string }>;
}

export interface HubCategoryResult {
  key: HubCategoryKey;
  kind: ProviderKindName;
  labelBn: string;
  labelEn: string;
  hintBn: string;
  total: number;
  online: number;
}

export interface HubResult {
  area: { id: string; name: string; nameBn: string | null; type: string } | null;
  categories: HubCategoryResult[];
  generatedAt: string;
}

export interface ProviderListResult {
  items: ProviderCard[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}
