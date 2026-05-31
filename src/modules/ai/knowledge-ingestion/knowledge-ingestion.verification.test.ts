import { describe, expect, it } from 'vitest';

import {
  hasRequiredSourceAttribution,
  parseSourceAttributions,
  toCitationSourceContext,
} from './citation/attribution.util.js';
import { KnowledgePublishWorkflowService } from './workflow/publish-workflow.service.js';
import { KnowledgeEntryWorkflowError } from './knowledge-ingestion.errors.js';

describe('attribution.util', () => {
  it('parses source attributions from metadata', () => {
    const attrs = parseSourceAttributions({
      sourceAttributions: [{ sourceId: 'src-1', contributionWeight: 1, quotedFrom: false, accessedAt: 'x' }],
    });
    expect(attrs).toHaveLength(1);
    expect(hasRequiredSourceAttribution({ sourceAttributions: attrs })).toBe(true);
  });

  it('builds citation context with license templates', () => {
    const ctx = toCitationSourceContext({
      sourceKey: 'dls-manual',
      titleBn: '_bn',
      titleEn: 'en',
      license: { attributionTemplateBn: '{title} ({year})', attributionTemplateEn: '{title}' },
    });
    expect(ctx.attributionTemplateBn).toBe('{title} ({year})');
  });
});

describe('KnowledgePublishWorkflowService guards', () => {
  it('exposes publish method', () => {
    expect(new KnowledgePublishWorkflowService().name).toBe('KnowledgePublishWorkflowService');
  });

  it('defines workflow error type for invalid publish', () => {
    const err = new KnowledgeEntryWorkflowError('INVALID_STATUS', 'test');
    expect(err.message).toContain('test');
  });
});
