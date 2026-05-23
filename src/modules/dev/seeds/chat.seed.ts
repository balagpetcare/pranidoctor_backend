import {
  AiAssistantStatus,
  AiMessageRole,
  type Prisma,
} from "../../../generated/prisma/client.js";

import {
  daysAgo,
  hashSeed,
  pick,
  stableId,
  type SeedResult,
  type SeedTx,
  type UserSeedContext,
} from "./faker.js";

function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export type ChatSeedResult = SeedResult & { messagesCreated: number };

export async function seedChatsForUser(
  tx: SeedTx,
  ctx: UserSeedContext,
): Promise<ChatSeedResult> {
  let created = 0;
  let skipped = 0;
  let messagesCreated = 0;
  let msgSeq = 0;

  for (let i = 1; i <= ctx.counts.conversations; i++) {
    if (messagesCreated >= ctx.counts.messages) break;

    const sessionId = stableId(ctx.idPrefix, "chat", i);
    const sessionExists = await tx.aiAssistantSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });
    if (sessionExists) {
      skipped++;
      continue;
    }

    const rng = createRng(hashSeed(ctx.userId, "chat", String(i)));

    if (!ctx.dryRun) {
      await tx.aiAssistantSession.create({
        data: {
          id: sessionId,
          userId: ctx.userId,
          locale: rng() > 0.3 ? "bn" : "en",
          status: pick(rng, [
            AiAssistantStatus.ACTIVE,
            AiAssistantStatus.CLOSED,
            AiAssistantStatus.ESCALATED,
          ]),
          createdAt: daysAgo(rng, 90),
        },
      });
    }
    created++;

    const remaining = ctx.counts.messages - messagesCreated;
    const remainingSessions = ctx.counts.conversations - i + 1;
    const targetMsgs = Math.max(
      1,
      Math.min(remaining, Math.ceil(remaining / remainingSessions)),
    );

    const msgBatch: Prisma.AiAssistantMessageCreateManyInput[] = [];
    for (let m = 0; m < targetMsgs && messagesCreated < ctx.counts.messages; m++) {
      msgSeq++;
      const msgId = stableId(ctx.idPrefix, "chatmsg", msgSeq, 5);
      msgBatch.push({
        id: msgId,
        sessionId,
        role: m % 2 === 0 ? AiMessageRole.USER : AiMessageRole.ASSISTANT,
        content:
          m % 2 === 0
            ? pick(rng, ["আমার গরু জ্বর করছে", "দুধ কমে গেছে", "টিকা কখন নেব?"])
            : pick(rng, [
                "লক্ষণ লক্ষ করুন; জরুরি হলে ডাক্তার ডাকুন।",
                "পর্যাপ্ত পানি ও ছায়া নিশ্চিত করুন।",
                "নিকটস্থ ভেটের সাথে যোগাযোগ করুন।",
              ]),
        locale: "bn",
        createdAt: daysAgo(rng, 60),
      });
      messagesCreated++;
    }

    if (!ctx.dryRun && msgBatch.length > 0) {
      await tx.aiAssistantMessage.createMany({ data: msgBatch, skipDuplicates: true });
    }
  }

  return { created, skipped, messagesCreated };
}

export async function clearChatsForUser(tx: SeedTx, idPrefix: string): Promise<number> {
  const sessions = await tx.aiAssistantSession.findMany({
    where: { id: { startsWith: `${idPrefix}-chat-` } },
    select: { id: true },
  });
  const sessionIds = sessions.map((s) => s.id);
  if (sessionIds.length === 0) return 0;

  await tx.aiAssistantMessage.deleteMany({
    where: { sessionId: { in: sessionIds } },
  });
  const result = await tx.aiAssistantSession.deleteMany({
    where: { id: { in: sessionIds } },
  });
  return result.count;
}
