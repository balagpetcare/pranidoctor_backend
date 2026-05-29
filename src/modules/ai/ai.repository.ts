import { ForbiddenError } from '../../shared/errors/http.errors.js';
import { getPrisma } from '../../shared/database/prisma.js';

export class AiRepository {
  readonly name = 'AiRepository';

  get db() {
    return getPrisma();
  }

  async resolveCustomerId(userId: string): Promise<string | null> {
    const profile = await getPrisma().customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    return profile?.id ?? null;
  }

  async assertCustomerOwnedLivestock(customerId: string, livestockId: string) {
    return getPrisma().livestock.findFirst({
      where: { id: livestockId, customerId, deletedAt: null },
    });
  }

  async assertCustomerOwnedFarm(customerId: string, farmRef: string): Promise<void> {
    const owned = await getPrisma().livestock.findFirst({
      where: { customerId, farmRef, deletedAt: null },
      select: { id: true },
    });
    if (owned) return;

    const inventory = await getPrisma().feedInventory.findFirst({
      where: { customerId, farmRef, deletedAt: null },
      select: { id: true },
    });
    if (inventory) return;

    throw new ForbiddenError('FARM_ACCESS_DENIED', 'Farm not accessible');
  }
}

let repository: AiRepository | null = null;

export function getAiRepository(): AiRepository {
  if (!repository) repository = new AiRepository();
  return repository;
}
