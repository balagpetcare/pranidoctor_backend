import { z } from 'zod';

export const customerAddressJsonSchema = z
  .object({
    areaLabel: z.string().trim().min(1).max(500).optional(),
    area: z.string().trim().min(1).max(500).optional(),
    label: z.string().trim().min(1).max(500).optional(),
    divisionId: z.string().min(1).optional(),
    districtId: z.string().min(1).optional(),
    upazilaId: z.string().min(1).optional(),
    unionId: z.string().min(1).optional(),
    villageId: z.string().min(1).optional(),
    line1: z.string().trim().max(500).optional(),
    postalCode: z.string().trim().max(20).optional(),
    divisionNameBn: z.string().optional(),
    districtNameBn: z.string().optional(),
    upazilaNameBn: z.string().optional(),
    unionNameBn: z.string().optional(),
    villageNameBn: z.string().optional(),
  })
  .strict();

export type CustomerAddressJson = z.infer<typeof customerAddressJsonSchema>;

export const patchAddressBodySchema = z
  .object({
    divisionId: z.string().min(1).optional(),
    districtId: z.string().min(1).optional(),
    upazilaId: z.string().min(1).optional(),
    unionId: z.string().min(1).optional(),
    villageId: z.string().min(1).optional(),
    line1: z.string().trim().max(500).optional(),
    postalCode: z.string().trim().max(20).optional(),
  })
  .strict();

export function readAreaLabel(addressJson: unknown): string | null {
  if (addressJson == null || typeof addressJson !== 'object' || Array.isArray(addressJson)) {
    return null;
  }
  const o = addressJson as Record<string, unknown>;
  const v = o.areaLabel ?? o.area ?? o.label;
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

export function isProfileComplete(args: {
  displayName: string;
  addressJson: unknown;
  primaryVillageId: string | null;
}): boolean {
  const nameOk = args.displayName.trim().length > 0;
  const areaOk =
    args.primaryVillageId != null ||
    readAreaLabel(args.addressJson) != null;
  return nameOk && areaOk;
}
