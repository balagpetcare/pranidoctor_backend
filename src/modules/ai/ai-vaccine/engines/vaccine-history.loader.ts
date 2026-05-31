import { getPrisma } from '../../../../shared/database/prisma.js';
import type { VaccinationHistoryRow } from './booster.engine.js';

export async function loadLivestockVaccinationHistory(params: {
  customerId: string;
  livestockId: string;
}): Promise<VaccinationHistoryRow[]> {
  const rows = await getPrisma().livestockVaccination.findMany({
    where: {
      customerId: params.customerId,
      livestockId: params.livestockId,
    },
    orderBy: { scheduledDate: 'desc' },
    take: 50,
  });

  return rows.map((row) => ({
    id: row.id,
    vaccineName: row.vaccineName,
    administeredDate: row.administeredDate,
    scheduledDate: row.scheduledDate,
    nextDueDate: row.nextDueDate,
  }));
}
