export class AiFailoverExhaustedError extends Error {
  readonly code = 'FAILOVER_EXHAUSTED';

  constructor(
    readonly taskType: string,
    readonly attempts: number,
    message?: string,
  ) {
    super(message ?? `All failover providers exhausted for task "${taskType}" after ${attempts} attempts`);
    this.name = 'AiFailoverExhaustedError';
  }
}

export class AiFailoverAbortedError extends Error {
  readonly code = 'FAILOVER_ABORTED';

  constructor(
    readonly taskType: string,
    readonly reason: string,
  ) {
    super(`Failover aborted for task "${taskType}": ${reason}`);
    this.name = 'AiFailoverAbortedError';
  }
}
