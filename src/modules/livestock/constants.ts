import { LivestockSpecies } from '@/generated/prisma/client';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export const SPECIES_LABELS: Record<
  LivestockSpecies,
  { en: string; bn: string }
> = {
  COW: { en: 'Cow', bn: 'গরু' },
  GOAT: { en: 'Goat', bn: 'ছাগল' },
  SHEEP: { en: 'Sheep', bn: 'ভেড়া' },
  CHICKEN: { en: 'Chicken', bn: 'মুরগি' },
  DUCK: { en: 'Duck', bn: 'হাঁস' },
  PIGEON: { en: 'Pigeon', bn: 'কবুতর' },
  BUFFALO: { en: 'Buffalo', bn: 'মহিষ' },
  HORSE: { en: 'Horse', bn: 'ঘোড়া' },
  CUSTOM: { en: 'Custom', bn: 'অন্যান্য (নিজস্ব)' },
  OTHER: { en: 'Other', bn: 'অন্যান্য' },
};

export const QR_PAYLOAD_PREFIX = 'pranidoctor://livestock/';

export const LIVESTOCK_ENTITY_TYPE = 'livestock';
export const LIVESTOCK_IMAGE_ENTITY_TYPE = 'livestock_image';
