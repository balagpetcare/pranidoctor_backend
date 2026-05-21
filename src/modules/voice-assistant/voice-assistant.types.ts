import type {
  VoiceBandwidthMode,
  VoiceSessionStatus,
  VoiceSttMode,
} from '../../generated/prisma/index.js';

export type { VoiceBandwidthMode, VoiceSessionStatus, VoiceSttMode };

export type VoiceLocale = 'bn' | 'en';

export const VOICE_CONFIDENCE_RETRY = 0.45;
export const VOICE_CONFIDENCE_CONFIRM = 0.7;
export const VOICE_MAX_RETRIES = 3;
export const VOICE_TRANSCRIPT_RETENTION_DAYS = 30;

export type SttRequest = {
  sessionId?: string;
  caseId?: string;
  mode: VoiceSttMode;
  partial?: boolean;
  transcript: string;
  locale?: VoiceLocale;
  confidence?: number;
  audioMetadata?: {
    durationMs?: number;
    sizeBytes?: number;
    codec?: string;
    bitrateKbps?: number;
  };
};

export type SttResponse = {
  sessionId: string;
  transcriptId: string;
  normalizedText: string;
  confidence: number;
  partial: boolean;
  retrySuggested: boolean;
  retryCount: number;
  fallbackHint: string | null;
};

export type VoiceChatRequest = {
  sessionId: string;
  transcriptId: string;
  interrupt?: boolean;
  resume?: boolean;
  lowTokenMode?: boolean;
  bandwidthMode?: VoiceBandwidthMode;
};

export type VoiceChatResponse = {
  sessionId: string;
  aiSessionId: string;
  transcriptText: string;
  responseText: string;
  responseAudio: {
    available: boolean;
    codec: string | null;
    bitrateKbps: number | null;
    transcriptOnly: boolean;
  };
  refused: boolean;
  humanRedirect: boolean;
  disclaimer: string;
  interrupted: boolean;
};

export type VoiceNavigationRequest = {
  sessionId: string;
  utterance: string;
  locale?: VoiceLocale;
};

export type VoiceNavigationAction =
  | 'OPEN_CASE'
  | 'BACK'
  | 'REPEAT'
  | 'CANCEL'
  | 'HELP'
  | 'UNKNOWN';

export type VoiceNavigationResponse = {
  action: VoiceNavigationAction;
  aliasMatched: string | null;
  message: string;
  success: boolean;
};

export type VoiceSessionDto = {
  sessionId: string;
  status: VoiceSessionStatus;
  locale: string;
  bandwidthMode: VoiceBandwidthMode;
  aiSessionId: string | null;
  caseId: string | null;
  retryCount: number;
  interruptedAt: string | null;
  transcripts: Array<{
    id: string;
    normalizedText: string;
    confidence: number;
    partial: boolean;
    createdAt: string;
  }>;
  lastNavigation: VoiceNavigationAction | null;
};

export type SttAdapterInput = {
  transcript: string;
  locale: VoiceLocale;
  confidence: number;
};

export type SttAdapterOutput = {
  normalizedText: string;
  confidence: number;
  retrySuggested: boolean;
  fallbackHint: string | null;
};

export type TtsAdapterInput = {
  text: string;
  locale: VoiceLocale;
  bandwidthMode: VoiceBandwidthMode;
  lowTokenMode?: boolean;
};

export type TtsAdapterOutput = {
  text: string;
  audioAvailable: boolean;
  codec: string | null;
  bitrateKbps: number | null;
  transcriptOnly: boolean;
};
