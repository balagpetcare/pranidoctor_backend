import { getPrisma } from '../../../../shared/database/prisma.js';

export type ContractAuditEvent = {
  id: string;
  contractId: string;
  eventType: string;
  actorId: string | null;
  previousStateJson: unknown;
  newStateJson: unknown;
  reason: string | null;
  createdAt: string;
};

export class ContractAuditService {
  readonly name = 'ContractAuditService';

  async getAuditHistory(
    contractId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ items: ContractAuditEvent[]; total: number }> {
    const prisma = getPrisma();

    const [rows, total] = await Promise.all([
      prisma.medicineContractAudit.findMany({
        where: { contractId },
        orderBy: { createdAt: 'desc' },
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
      }),
      prisma.medicineContractAudit.count({ where: { contractId } }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        contractId: row.contractId,
        eventType: row.eventType,
        actorId: row.actorId,
        previousStateJson: row.previousStateJson,
        newStateJson: row.newStateJson,
        reason: row.reason,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
    };
  }

  async getAuditEventsByActor(
    actorId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<ContractAuditEvent[]> {
    const prisma = getPrisma();

    const rows = await prisma.medicineContractAudit.findMany({
      where: { actorId },
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });

    return rows.map((row) => ({
      id: row.id,
      contractId: row.contractId,
      eventType: row.eventType,
      actorId: row.actorId,
      previousStateJson: row.previousStateJson,
      newStateJson: row.newStateJson,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async getRecentAuditEvents(
    options?: { limit?: number; eventTypes?: string[] },
  ): Promise<ContractAuditEvent[]> {
    const prisma = getPrisma();

    const rows = await prisma.medicineContractAudit.findMany({
      where: options?.eventTypes ? { eventType: { in: options.eventTypes } } : {},
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 100,
    });

    return rows.map((row) => ({
      id: row.id,
      contractId: row.contractId,
      eventType: row.eventType,
      actorId: row.actorId,
      previousStateJson: row.previousStateJson,
      newStateJson: row.newStateJson,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async getAuditStats(): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    uniqueActors: number;
    recentActivity: { date: string; count: number }[];
  }> {
    const prisma = getPrisma();

    const [totalEvents, eventsByType, uniqueActors] = await Promise.all([
      prisma.medicineContractAudit.count(),
      prisma.medicineContractAudit.groupBy({
        by: ['eventType'],
        _count: { id: true },
      }),
      prisma.medicineContractAudit.findMany({
        where: { actorId: { not: null } },
        select: { actorId: true },
        distinct: ['actorId'],
      }),
    ]);

    const eventsByTypeMap: Record<string, number> = {};
    for (const e of eventsByType) {
      eventsByTypeMap[e.eventType] = e._count.id;
    }

    return {
      totalEvents,
      eventsByType: eventsByTypeMap,
      uniqueActors: uniqueActors.length,
      recentActivity: [],
    };
  }
}

let service: ContractAuditService | null = null;

export function getContractAuditService(): ContractAuditService {
  if (!service) service = new ContractAuditService();
  return service;
}

export function resetContractAuditServiceForTests(): void {
  service = null;
}
