import { describe, expect, it } from 'vitest';

import { isStrongEnoughPassword } from './password-reset.service.js';
import { getPasswordResetStore } from './password-reset.store.js';

describe('password reset store (in-memory fallback, Redis not initialised)', () => {
  it('saves, loads and clears a code', async () => {
    const store = getPasswordResetStore();
    expect(store).not.toBeNull();
    await store!.save('u1', { hash: 'abc' }, 60);
    expect(await store!.load('u1')).toEqual({ hash: 'abc' });
    await store!.clear('u1');
    expect(await store!.load('u1')).toBeNull();
  });

  it('counts attempts and resets them when a new code is saved', async () => {
    const store = getPasswordResetStore()!;
    expect(await store.addAttempt('u2', 60)).toBe(1);
    expect(await store.addAttempt('u2', 60)).toBe(2);
    await store.save('u2', { hash: 'x' }, 60);
    expect(await store.addAttempt('u2', 60)).toBe(1);
  });

  it('enforces the resend cooldown', async () => {
    const store = getPasswordResetStore()!;
    expect(await store.tryStartCooldown('u3', 60)).toBe(false);
    expect(await store.tryStartCooldown('u3', 60)).toBe(true);
  });
});

describe('password strength', () => {
  it('needs 8+ characters with a letter and a digit', () => {
    expect(isStrongEnoughPassword('abc12345')).toBe(true);
    expect(isStrongEnoughPassword('abcdefgh')).toBe(false);
    expect(isStrongEnoughPassword('12345678')).toBe(false);
    expect(isStrongEnoughPassword('ab1')).toBe(false);
  });
});
