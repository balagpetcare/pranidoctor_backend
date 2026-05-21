import { eventBus, EventTypes } from '../../shared/events/index.js';

import type { AnimalSpecies } from './animals.types.js';

export interface AnimalCreatedPayload {
  animalId: string;
  ownerId: string;
  species: AnimalSpecies;
  timestamp: Date;
}

export interface AnimalUpdatedPayload {
  animalId: string;
  changes: string[];
  timestamp: Date;
}

export const animalsEvents = {
  emitAnimalCreated: async (payload: AnimalCreatedPayload): Promise<void> => {
    await eventBus.publish(EventTypes.ANIMAL_CREATED, payload, 'animals');
  },

  emitAnimalUpdated: async (payload: AnimalUpdatedPayload): Promise<void> => {
    await eventBus.publish(EventTypes.ANIMAL_UPDATED, payload, 'animals');
  },
};
