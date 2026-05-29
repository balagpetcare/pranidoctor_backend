import { Prisma } from '@/generated/prisma/client';

export function toDecimal(value: number | string | Prisma.Decimal | null | undefined): Prisma.Decimal | null {
  if (value == null) return null;
  return new Prisma.Decimal(value);
}

export function decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value == null) return null;
  return Number(value);
}
