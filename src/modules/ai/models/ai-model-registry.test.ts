import { afterEach, describe, expect, it } from 'vitest';

import {
  filterByCapabilities,
  getAiCapabilityMatrixService,
  modelHasCapabilities,
  normalizeCapabilities,
  requiredCapabilitiesForTask,
  resetAiCapabilityMatrixServiceForTests,
  serializeCapabilities,
} from './ai-capability-matrix.service.js';
import { inferModelFamily } from './manifests/builtin-family-manifests.js';

describe('ai-capability-matrix.service', () => {
  afterEach(() => {
    resetAiCapabilityMatrixServiceForTests();
  });

  it('normalizes legacy string array capabilities', () => {
    expect(normalizeCapabilities(['chat', 'vision', 'invalid'])).toEqual(['chat', 'vision']);
  });

  it('normalizes structured capabilities object', () => {
    expect(normalizeCapabilities({ capabilities: ['chat', 'streaming'] })).toEqual([
      'chat',
      'streaming',
    ]);
  });

  it('serializes unique capabilities', () => {
    expect(serializeCapabilities(['chat', 'chat', 'vision'])).toEqual({
      capabilities: ['chat', 'vision'],
    });
  });

  it('checks required capabilities', () => {
    expect(modelHasCapabilities(['chat', 'vision'], ['chat'])).toBe(true);
    expect(modelHasCapabilities(['chat'], ['chat', 'vision'])).toBe(false);
  });

  it('filters models by capabilities', () => {
    const models = [
      { id: '1', capabilities: ['chat'] as const },
      { id: '2', capabilities: ['chat', 'vision'] as const },
    ];
    const filtered = filterByCapabilities(
      models.map((m) => ({ ...m, capabilities: [...m.capabilities] })),
      ['chat', 'vision'],
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('2');
  });

  it('maps task types to required capabilities', () => {
    expect(requiredCapabilitiesForTask('vision')).toEqual(['chat', 'vision']);
    expect(requiredCapabilitiesForTask('unknown')).toEqual(['chat']);
  });

  it('exposes service helpers', () => {
    const svc = getAiCapabilityMatrixService();
    expect(svc.forTask('embedding')).toEqual(['embeddings']);
    expect(svc.hasAll(['chat', 'embeddings'], ['embeddings'])).toBe(true);
  });
});

describe('builtin-family-manifests', () => {
  it('infers model family from modelKey', () => {
    expect(inferModelFamily('gpt-4o-mini')).toBe('gpt');
    expect(inferModelFamily('openai/gpt-4o-mini')).toBe('gpt');
    expect(inferModelFamily('claude-3-5-sonnet-20241022')).toBe('claude');
    expect(inferModelFamily('qwen/qwen-2.5-72b-instruct')).toBe('qwen');
    expect(inferModelFamily('meta-llama/llama-3.3-70b-instruct')).toBe('llama');
    expect(inferModelFamily('grok-2-1212')).toBe('grok');
    expect(inferModelFamily('unknown-model')).toBeNull();
  });
});
