import { nanoid } from 'nanoid';

import { getLogger } from '../logger/logger.js';

import type { DomainEvent, EventHandler, EventSubscription } from './event.types.js';

class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private wildcardHandlers: Set<EventHandler> = new Set();

  subscribe<T>(eventType: string, handler: EventHandler<T>): EventSubscription {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    const handlers = this.handlers.get(eventType)!;
    handlers.add(handler as EventHandler);

    return {
      eventType,
      handler: handler as EventHandler,
      unsubscribe: () => {
        handlers.delete(handler as EventHandler);
      },
    };
  }

  subscribeAll(handler: EventHandler): EventSubscription {
    this.wildcardHandlers.add(handler);

    return {
      eventType: '*',
      handler,
      unsubscribe: () => {
        this.wildcardHandlers.delete(handler);
      },
    };
  }

  async publish<T>(
    type: string,
    payload: T,
    source: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const logger = getLogger();

    const event: DomainEvent<T> = {
      id: nanoid(),
      type,
      timestamp: new Date(),
      source,
      payload,
      ...(metadata !== undefined ? { metadata } : {}),
    };

    logger.debug({
      msg: 'Event published',
      eventId: event.id,
      eventType: type,
      source,
    });

    const handlers = this.handlers.get(type) ?? new Set();
    const allHandlers = [...handlers, ...this.wildcardHandlers];

    const results = await Promise.allSettled(
      allHandlers.map((handler) => handler(event as DomainEvent))
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        logger.error({
          msg: 'Event handler failed',
          eventId: event.id,
          eventType: type,
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
        });
      }
    }
  }

  clear(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
  }

  getHandlerCount(eventType: string): number {
    return this.handlers.get(eventType)?.size ?? 0;
  }

  getAllEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}

export const eventBus = new EventBus();
