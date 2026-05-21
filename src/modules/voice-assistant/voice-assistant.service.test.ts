import { describe, expect, it, vi, beforeEach } from 'vitest';

const findSessionForUser = vi.fn();
const updateSession = vi.fn();

vi.mock('./repository/voice.repository.js', () => ({
  getVoiceRepository: () => ({
    findSessionForUser,
    updateSession,
  }),
}));

import { VoiceAssistantService } from './voice-assistant.service.js';

describe('voice-assistant interruption', () => {
  beforeEach(() => {
    findSessionForUser.mockReset();
    updateSession.mockReset();
  });

  it('marks session interrupted without AI call', async () => {
    findSessionForUser.mockResolvedValue({
      id: 'vs1',
      aiSessionId: 'ai1',
      locale: 'bn',
      status: 'ACTIVE',
    });
    updateSession.mockResolvedValue({});

    const service = new VoiceAssistantService();
    const result = await service.chat('user1', {
      sessionId: 'vs1',
      transcriptId: 't1',
      interrupt: true,
    });

    expect(result.interrupted).toBe(true);
    expect(updateSession).toHaveBeenCalledWith(
      'vs1',
      expect.objectContaining({ status: 'INTERRUPTED' }),
    );
  });
});
