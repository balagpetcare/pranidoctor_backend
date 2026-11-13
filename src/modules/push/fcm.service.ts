import { importPKCS8, SignJWT } from 'jose';

import { getPrisma } from '../../shared/database/prisma.js';

export type FcmConfig = { projectId: string; clientEmail: string; privateKey: string };

/** Reads FCM service-account settings; null when push is not configured (sending becomes a no-op). */
export function readFcmConfig(env: NodeJS.ProcessEnv = process.env): FcmConfig | null {
  const projectId = env.FCM_PROJECT_ID?.trim();
  const clientEmail = env.FCM_CLIENT_EMAIL?.trim();
  const privateKey = env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  return projectId && clientEmail && privateKey ? { projectId, clientEmail, privateKey } : null;
}

export type PushPayload = { title: string; body: string; data?: Record<string, string> };

export function buildFcmMessage(token: string, p: PushPayload) {
  return {
    message: {
      token,
      notification: { title: p.title, body: p.body },
      ...(p.data ? { data: p.data } : {}),
      android: { priority: 'HIGH' as const },
    },
  };
}

let cached: { token: string; exp: number } | null = null;

async function accessToken(cfg: FcmConfig): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 60 > now) return cached.token;
  const key = await importPKCS8(cfg.privateKey, 'RS256');
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(cfg.clientEmail)
    .setSubject(cfg.clientEmail)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) return null;
  cached = { token: j.access_token, exp: now + (j.expires_in ?? 3000) };
  return j.access_token;
}

/** Best-effort push to all active devices of a user. Never throws. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  try {
    const cfg = readFcmConfig();
    if (!cfg) return 0;
    const prisma = getPrisma();
    const devices = await prisma.userDevice.findMany({
      where: { userId, revokedAt: null, pushToken: { not: null } },
      select: { id: true, pushToken: true },
      take: 5,
    });
    if (devices.length === 0) return 0;
    const at = await accessToken(cfg);
    if (!at) return 0;
    let sent = 0;
    for (const d of devices) {
      if (!d.pushToken) continue;
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${cfg.projectId}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildFcmMessage(d.pushToken, payload)),
      });
      if (res.ok) sent += 1;
      else if (res.status === 404 || res.status === 400) {
        // Token no longer valid for this app: stop sending to it.
        await prisma.userDevice.update({ where: { id: d.id }, data: { pushToken: null } }).catch(() => undefined);
      }
    }
    return sent;
  } catch {
    return 0;
  }
}
