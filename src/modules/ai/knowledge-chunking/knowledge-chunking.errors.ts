export class KnowledgeChunkingError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'KnowledgeChunkingError';
  }
}

export class KnowledgeVersionNotFoundForChunkingError extends KnowledgeChunkingError {
  constructor(versionId: string) {
    super('VERSION_NOT_FOUND', `Knowledge version not found: ${versionId}`);
  }
}

export class ChunkPublishGateError extends KnowledgeChunkingError {
  constructor(code: string, message: string) {
    super(code, message);
  }
}
