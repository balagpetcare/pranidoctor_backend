export class AiRouteNotFoundError extends Error {
  readonly code = 'ROUTE_NOT_FOUND';

  constructor(
    readonly taskType: string,
    readonly scopeKeys: string[],
  ) {
    super(`No enabled AI route for task "${taskType}" in scopes: ${scopeKeys.join(', ')}`);
    this.name = 'AiRouteNotFoundError';
  }
}

export class AiModelNotFoundError extends Error {
  readonly code = 'MODEL_NOT_FOUND';

  constructor(
    readonly providerKey: string,
    readonly scopeKey: string,
  ) {
    super(`No enabled model for provider "${providerKey}" in scope "${scopeKey}"`);
    this.name = 'AiModelNotFoundError';
  }
}
