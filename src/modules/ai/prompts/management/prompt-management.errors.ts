export class PromptNotFoundError extends Error {
  readonly code = 'PROMPT_NOT_FOUND';

  constructor(message = 'Prompt not found') {
    super(message);
    this.name = 'PromptNotFoundError';
  }
}

export class PromptNotDraftError extends Error {
  readonly code = 'PROMPT_NOT_DRAFT';

  constructor(message = 'Only draft prompts can be edited') {
    super(message);
    this.name = 'PromptNotDraftError';
  }
}

export class PromptPublishError extends Error {
  readonly code = 'PROMPT_PUBLISH_FAILED';

  constructor(message: string) {
    super(message);
    this.name = 'PromptPublishError';
  }
}

export class PromptRollbackError extends Error {
  readonly code = 'PROMPT_ROLLBACK_FAILED';

  constructor(message: string) {
    super(message);
    this.name = 'PromptRollbackError';
  }
}
