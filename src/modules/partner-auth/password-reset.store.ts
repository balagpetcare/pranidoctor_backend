import { getConfig } from '../../shared/config/config.loader.js';
import { getRedis, isRedisInitialized, prefixKey } from '../../infra/redis/redis.client.js';

/**
 * Short-lived storage for password-reset codes.
 * Redis when available; in-process memory only outside production (dev convenience).
 */
export interface PasswordResetRecord {
  /** HMAC of the code — the plain code is never stored. */
  hash: string;
}

export interface PasswordResetStore {
  save(userId: string, record: PasswordResetRecord, ttlSeconds: number): Promise<void>;
  load(userId: string): Promise<PasswordResetRecord | null>;
  /** Increments and returns the failed-attempt counter for the current code. */
  addAttempt(userId: string, ttlSeconds: number): Promise<number>;
  clear(userId: string): Promise<void>;
  /** true = a code was sent too recently (still cooling down); otherwise arms the cooldown. */
  tryStartCooldown(userId: string, seconds: number): Promise<boolean>;
  /** Counts sends inside a rolling window; returns the new count. */
  countSend(userId: string, windowSeconds: number): Promise<number>;
}

class RedisPasswordResetStore implements PasswordResetStore {
  private key(kind: string, userId: string): string {
    return prefixKey(getConfig(), `pwreset:${kind}:${userId}`);
  }

  async save(userId: string, record: PasswordResetRecord, ttlSeconds: number): Promise<void> {
    const redis = getRedis();
    await redis.set(this.key('code', userId), JSON.stringify(record), 'EX', ttlSeconds);
    await redis.del(this.key('attempts', userId));
  }

  async load(userId: string): Promise<PasswordResetRecord | null> {
    const raw = await getRedis().get(this.key('code', userId));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as PasswordResetRecord;
      return typeof parsed.hash === 'string' ? parsed : null;
    } catch {
      return null;
    }
  }

  async addAttempt(userId: string, ttlSeconds: number): Promise<number> {
    const redis = getRedis();
    const k = this.key('attempts', userId);
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, ttlSeconds);
    return n;
  }

  async clear(userId: string): Promise<void> {
    await getRedis().del(this.key('code', userId), this.key('attempts', userId));
  }

  async tryStartCooldown(userId: string, seconds: number): Promise<boolean> {
    const set = await getRedis().set(this.key('cooldown', userId), '1', 'EX', seconds, 'NX');
    return set === null;
  }

  async countSend(userId: string, windowSeconds: number): Promise<number> {
    const redis = getRedis();
    const k = this.key('sends', userId);
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, windowSeconds);
    return n;
  }
}

class MemoryPasswordResetStore implements PasswordResetStore {
  private readonly data = new Map<string, { value: string; expiresAt: number }>();

  private get(k: string): string | null {
    const e = this.data.get(k);
    if (!e) return null;
    if (e.expiresAt <= Date.now()) {
      this.data.delete(k);
      return null;
    }
    return e.value;
  }

  private put(k: string, value: string, ttlSeconds: number): void {
    this.data.set(k, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async save(userId: string, record: PasswordResetRecord, ttlSeconds: number): Promise<void> {
    this.put(`code:${userId}`, JSON.stringify(record), ttlSeconds);
    this.data.delete(`attempts:${userId}`);
  }

  async load(userId: string): Promise<PasswordResetRecord | null> {
    const raw = this.get(`code:${userId}`);
    return raw ? (JSON.parse(raw) as PasswordResetRecord) : null;
  }

  async addAttempt(userId: string, ttlSeconds: number): Promise<number> {
    const k = `attempts:${userId}`;
    const n = Number(this.get(k) ?? '0') + 1;
    const existing = this.data.get(k);
    this.data.set(k, {
      value: String(n),
      expiresAt: existing ? existing.expiresAt : Date.now() + ttlSeconds * 1000,
    });
    return n;
  }

  async clear(userId: string): Promise<void> {
    this.data.delete(`code:${userId}`);
    this.data.delete(`attempts:${userId}`);
  }

  async tryStartCooldown(userId: string, seconds: number): Promise<boolean> {
    const k = `cooldown:${userId}`;
    if (this.get(k) !== null) return true;
    this.put(k, '1', seconds);
    return false;
  }

  async countSend(userId: string, windowSeconds: number): Promise<number> {
    const k = `sends:${userId}`;
    const n = Number(this.get(k) ?? '0') + 1;
    const existing = this.data.get(k);
    this.data.set(k, {
      value: String(n),
      expiresAt: existing ? existing.expiresAt : Date.now() + windowSeconds * 1000,
    });
    return n;
  }
}

let memoryStore: MemoryPasswordResetStore | null = null;

/** null → no safe store (production without Redis). */
export function getPasswordResetStore(): PasswordResetStore | null {
  if (isRedisInitialized()) return new RedisPasswordResetStore();
  if (process.env['NODE_ENV'] === 'production') return null;
  memoryStore ??= new MemoryPasswordResetStore();
  return memoryStore;
}
