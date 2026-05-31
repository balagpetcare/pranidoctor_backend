import { NotFoundError, ValidationError } from '../../../shared/errors/http.errors.js';

export class KnowledgeSourceNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('KNOWLEDGE_SOURCE_NOT_FOUND', `Knowledge source not found: ${id}`);
  }
}

export class KnowledgeEntryWorkflowError extends ValidationError {
  constructor(code: string, message: string) {
    super(code, message);
  }
}

export class KnowledgeImportError extends ValidationError {
  constructor(code: string, message: string) {
    super(code, message);
  }
}
