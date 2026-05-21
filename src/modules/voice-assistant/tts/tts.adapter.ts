import type { TtsAdapterInput, TtsAdapterOutput, VoiceBandwidthMode } from '../voice-assistant.types.js';

export interface TtsAdapter {
  readonly name: string;
  synthesize(input: TtsAdapterInput): TtsAdapterOutput;
}

function truncateForVoice(text: string, lowTokenMode?: boolean): string {
  if (!lowTokenMode) return text;
  const sentences = text.split(/(?<=[.!?।])\s+/u);
  return sentences.slice(0, 2).join(' ').slice(0, 280);
}

export function resolveBandwidthPolicy(mode: VoiceBandwidthMode): {
  transcriptOnly: boolean;
  codec: string | null;
  bitrateKbps: number | null;
} {
  switch (mode) {
    case 'TRANSCRIPT_ONLY':
      return { transcriptOnly: true, codec: null, bitrateKbps: null };
    case 'LOW':
      return { transcriptOnly: false, codec: 'opus', bitrateKbps: 16 };
    default:
      return { transcriptOnly: false, codec: 'opus', bitrateKbps: 32 };
  }
}

export class TranscriptFirstTtsAdapter implements TtsAdapter {
  readonly name = 'transcript-first-v1';

  synthesize(input: TtsAdapterInput): TtsAdapterOutput {
    const policy = resolveBandwidthPolicy(input.bandwidthMode);
    const text = truncateForVoice(input.text, input.lowTokenMode);

    return {
      text,
      audioAvailable: !policy.transcriptOnly,
      codec: policy.codec,
      bitrateKbps: policy.bitrateKbps,
      transcriptOnly: policy.transcriptOnly,
    };
  }
}

let ttsAdapter: TtsAdapter | null = null;

export function getTtsAdapter(): TtsAdapter {
  if (!ttsAdapter) ttsAdapter = new TranscriptFirstTtsAdapter();
  return ttsAdapter;
}
