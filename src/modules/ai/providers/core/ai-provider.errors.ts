export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly provider: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

export class AiProviderNotConfiguredError extends AiProviderError {
  constructor(provider: string) {
    super(`${provider} API key not configured in vault`, 'PROVIDER_NOT_CONFIGURED', provider);
    this.name = 'AiProviderNotConfiguredError';
  }
}
