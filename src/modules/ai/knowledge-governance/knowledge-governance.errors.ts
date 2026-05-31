import { KnowledgeFoundationError } from '../knowledge-foundation/knowledge-foundation.errors.js';

export class KnowledgeGovernanceError extends KnowledgeFoundationError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = 'KnowledgeGovernanceError';
  }
}
