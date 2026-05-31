export class KnowledgeFoundationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'KnowledgeFoundationError';
  }
}

export class KnowledgeEntityNotFoundError extends KnowledgeFoundationError {
  constructor(id: string) {
    super('ENTITY_NOT_FOUND', `Knowledge entity not found: ${id}`);
  }
}

export class KnowledgeVersionNotFoundError extends KnowledgeFoundationError {
  constructor(id: string) {
    super('VERSION_NOT_FOUND', `Knowledge version not found: ${id}`);
  }
}

export class KnowledgeCitationNotFoundError extends KnowledgeFoundationError {
  constructor(id: string) {
    super('CITATION_NOT_FOUND', `Knowledge citation not found: ${id}`);
  }
}

export class KnowledgeReviewNotFoundError extends KnowledgeFoundationError {
  constructor(id: string) {
    super('REVIEW_NOT_FOUND', `Knowledge review not found: ${id}`);
  }
}

export class KnowledgeVersionImmutableError extends KnowledgeFoundationError {
  constructor(status: string) {
    super('VERSION_IMMUTABLE', `Version in status ${status} cannot be edited`);
  }
}

export class KnowledgeWorkflowError extends KnowledgeFoundationError {
  constructor(code: string, message: string) {
    super(code, message);
  }
}
