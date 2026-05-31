export class KnowledgeImportError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'KnowledgeImportError';
  }
}

export class KnowledgeImportSourceNotFoundError extends KnowledgeImportError {
  constructor(id: string) {
    super('SOURCE_NOT_FOUND', `Knowledge source not found: ${id}`);
  }
}

export class KnowledgeImportRunNotFoundError extends KnowledgeImportError {
  constructor(id: string) {
    super('IMPORT_RUN_NOT_FOUND', `Import run not found: ${id}`);
  }
}

export class KnowledgeImportProfileNotFoundError extends KnowledgeImportError {
  constructor(key: string) {
    super('PROFILE_NOT_FOUND', `Source family profile not found: ${key}`);
  }
}

export class KnowledgeImportValidationError extends KnowledgeImportError {
  constructor(code: string, message: string) {
    super(code, message);
  }
}

export class KnowledgeImportJobFailedError extends KnowledgeImportError {
  constructor(message: string) {
    super('IMPORT_JOB_FAILED', message);
  }
}
