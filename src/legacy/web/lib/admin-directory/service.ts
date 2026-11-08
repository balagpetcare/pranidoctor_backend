import { z } from "zod";

import {
  AuthAuditAction,
  Prisma,
  UserRole,
  UserStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const page = {
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
};

export const listUsersQuerySchema = z.object({
  ...page,
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});
export const listCustomersQuerySchema = z.object({ ...page });
export const listAnimalsQuerySchema = z.object({
  ...page,
  species: z.string().trim().max(60).optional(),
  active: z.enum(["true", "false"]).optional(),
});
export const listAuthAuditQuerySchema = z.object({
  ...page,
  action: z.nativeEnum(AuthAuditAction).optional(),
  channel: z.string().trim().max(40).optional(),
});

/** Never selects passwordHash / tokens. */
const userSafeSelect = {
  id: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export async function listUsers(q: z.infer<typeof listUsersQuerySchema>) {
  const where: Prisma.UserWhereInput = {
    ...(q.role ? { role: q.role } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.q
      ? {
          OR: [
            { email: { contains: q.q, mode: "insensitive" } },
            { phone: { contains: q.q } },
          ],
        }
      : {}),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSafeSelect,
      orderBy: { createdAt: "desc" },
      take: q.limit,
      skip: q.offset,
    }),
    prisma.user.count({ where }),
  ]);
  return { users, meta: { total, limit: q.limit, offset: q.offset } };
}

export async function listCustomers(q: z.infer<typeof listCustomersQuerySchema>) {
  const where: Prisma.CustomerProfileWhereInput = q.q
    ? {
        OR: [
          { displayName: { contains: q.q, mode: "insensitive" } },
          { primaryVillageName: { contains: q.q, mode: "insensitive" } },
          { user: { email: { contains: q.q, mode: "insensitive" } } },
          { user: { phone: { contains: q.q } } },
        ],
      }
    : {};
  const [rows, total] = await Promise.all([
    prisma.customerProfile.findMany({
      where,
      select: {
        id: true,
        displayName: true,
        primaryVillageName: true,
        createdAt: true,
        user: { select: userSafeSelect },
        _count: { select: { animals: true, farms: true } },
      },
      orderBy: { createdAt: "desc" },
      take: q.limit,
      skip: q.offset,
    }),
    prisma.customerProfile.count({ where }),
  ]);
  return {
    customers: rows.map(({ _count, ...r }) => ({
      ...r,
      animalCount: _count.animals,
      farmCount: _count.farms,
    })),
    meta: { total, limit: q.limit, offset: q.offset },
  };
}

export async function listAnimals(q: z.infer<typeof listAnimalsQuerySchema>) {
  const where: Prisma.AnimalProfileWhereInput = {
    ...(q.species ? { species: { equals: q.species, mode: "insensitive" } } : {}),
    ...(q.active ? { active: q.active === "true" } : {}),
    ...(q.q
      ? {
          OR: [
            { name: { contains: q.q, mode: "insensitive" } },
            { breed: { contains: q.q, mode: "insensitive" } },
            { microchipOrTag: { contains: q.q, mode: "insensitive" } },
            { customer: { displayName: { contains: q.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.animalProfile.findMany({
      where,
      select: {
        id: true,
        name: true,
        species: true,
        breed: true,
        category: true,
        sex: true,
        active: true,
        dateOfBirth: true,
        weightKg: true,
        createdAt: true,
        customer: { select: { id: true, displayName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: q.limit,
      skip: q.offset,
    }),
    prisma.animalProfile.count({ where }),
  ]);
  return {
    animals: rows.map((a) => ({ ...a, weightKg: a.weightKg == null ? null : Number(a.weightKg) })),
    meta: { total, limit: q.limit, offset: q.offset },
  };
}

export async function listAuthAudit(q: z.infer<typeof listAuthAuditQuerySchema>) {
  const where: Prisma.AuthAuditEventWhereInput = {
    ...(q.action ? { action: q.action } : {}),
    ...(q.channel ? { channel: q.channel } : {}),
    ...(q.q
      ? {
          OR: [
            { ipAddress: { contains: q.q } },
            { user: { email: { contains: q.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.authAuditEvent.findMany({
      where,
      select: {
        id: true,
        action: true,
        role: true,
        channel: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        user: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: q.limit,
      skip: q.offset,
    }),
    prisma.authAuditEvent.count({ where }),
  ]);
  return { events: rows, meta: { total, limit: q.limit, offset: q.offset } };
}
