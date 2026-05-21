import type { VoiceLocale, VoiceNavigationAction } from '../voice-assistant.types.js';

type NavRule = {
  action: VoiceNavigationAction;
  aliases: string[];
  messageBn: string;
  messageEn: string;
};

const RULES: NavRule[] = [
  {
    action: 'OPEN_CASE',
    aliases: ['কেস খুল', 'case kholo', 'case khul', 'kes kholo', 'খুল'],
    messageBn: 'কেস খোলার জন্য প্রস্তুত',
    messageEn: 'Ready to open case',
  },
  {
    action: 'BACK',
    aliases: ['পিছনে', 'pichon', 'pichon ja', 'back', 'ফিরে'],
    messageBn: 'পিছনে যাচ্ছি',
    messageEn: 'Going back',
  },
  {
    action: 'REPEAT',
    aliases: ['আবার', 'abar', 'repeat', 'আবার বল'],
    messageBn: 'আবার শুনুন',
    messageEn: 'Repeating last response',
  },
  {
    action: 'CANCEL',
    aliases: ['বাতিল', 'cancel', 'থাম', 'stop'],
    messageBn: 'বাতিল করা হয়েছে',
    messageEn: 'Cancelled',
  },
  {
    action: 'HELP',
    aliases: ['সাহায্য', 'help', 'madad', 'সহায়তা'],
    messageBn: 'বলুন: কেস খুল, পিছনে, আবার, বাতিল',
    messageEn: 'Say: open case, back, repeat, cancel',
  },
];

export function resolveNavigationCommand(
  utterance: string,
  locale: VoiceLocale,
): { action: VoiceNavigationAction; aliasMatched: string | null; message: string; success: boolean } {
  const normalized = utterance.trim().toLowerCase();

  for (const rule of RULES) {
    for (const alias of rule.aliases) {
      if (normalized.includes(alias.toLowerCase())) {
        return {
          action: rule.action,
          aliasMatched: alias,
          message: locale === 'bn' ? rule.messageBn : rule.messageEn,
          success: rule.action !== 'UNKNOWN',
        };
      }
    }
  }

  return {
    action: 'UNKNOWN',
    aliasMatched: null,
    message:
      locale === 'bn'
        ? 'বুঝতে পারিনি — সাহায্য বলুন'
        : 'Did not understand — say help',
    success: false,
  };
}

export function listNavigationActions(): VoiceNavigationAction[] {
  return ['OPEN_CASE', 'BACK', 'REPEAT', 'CANCEL', 'HELP'];
}
