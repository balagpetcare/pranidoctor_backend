import { describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';

import {
  BCRYPT_COST,
  createSuperAdmin,
  validateEmail,
  validatePassword,
  validatePhone,
  type AdminStore,
} from '../../../scripts/bootstrap-super-admin-lib.js';

interface State {
  users: Array<{ id: string; email: string; phone: string | null; role: string; status: string; passwordHash: string }>;
  profiles: Array<{ userId: string; displayName: string }>;
  seq: number;
}

function makeStore(state: State): AdminStore {
  const tx: AdminStore = {
    user: {
      async findFirst(args: any) {
        const w = args?.where ?? {};
        const hit = state.users.find(
          (u) =>
            (w.role === undefined || u.role === w.role || (w.role?.in ?? []).includes(u.role)) &&
            (w.email === undefined || u.email === w.email) &&
            (w.phone === undefined || u.phone === w.phone),
        );
        return hit ? { id: hit.id, email: hit.email } : null;
      },
      async findUnique(args: any) {
        const hit = state.users.find((u) => u.email === args?.where?.email);
        return hit ? { id: hit.id } : null;
      },
      async create(args: any) {
        const d = args.data;
        // Simulate unique constraint on email/phone.
        if (state.users.some((u) => u.email === d.email)) {
          const e: any = new Error('Unique constraint failed on the fields: (`email`)');
          e.code = 'P2002';
          throw e;
        }
        if (d.phone && state.users.some((u) => u.phone === d.phone)) {
          const e: any = new Error('Unique constraint failed on the fields: (`phone`)');
          e.code = 'P2002';
          throw e;
        }
        const row = { id: `u${++state.seq}`, ...d };
        state.users.push(row);
        return { id: row.id, email: row.email };
      },
    },
    adminProfile: {
      async create(args: any) {
        state.profiles.push(args.data);
        return args.data;
      },
    },
    async $transaction(fn: any) {
      return fn(tx);
    },
  };
  return tx;
}

const base = { email: 'boss@pranidoctor.com', displayName: 'Boss', password: 'Sup3rSecure!Pass' };

describe('validators', () => {
  it('accepts + normalizes email', () => {
    expect(validateEmail('  Boss@PraniDoctor.COM ')).toBe('boss@pranidoctor.com');
  });
  it('rejects bad email', () => {
    expect(() => validateEmail('not-an-email')).toThrow('Invalid email');
  });
  it('accepts BD phone variants and normalizes to +880', () => {
    expect(validatePhone('01712345678')).toBe('+8801712345678');
    expect(validatePhone('+8801712345678')).toBe('+8801712345678');
    expect(validatePhone('8801712345678')).toBe('+8801712345678');
    expect(validatePhone('')).toBeNull();
    expect(validatePhone(null)).toBeNull();
  });
  it('rejects bad phone', () => {
    expect(() => validatePhone('012345')).toThrow('Bangladesh');
  });
  it('enforces password length', () => {
    expect(() => validatePassword('short')).toThrow('8');
    expect(() => validatePassword('x'.repeat(129))).toThrow('128');
    expect(validatePassword('12345678')).toBeUndefined();
  });
});

describe('createSuperAdmin', () => {
  it('creates SUPER_ADMIN + AdminProfile with bcrypt hash', async () => {
    const state: State = { users: [], profiles: [], seq: 0 };
    const res = await createSuperAdmin(makeStore(state), base);
    expect(res.email).toBe('boss@pranidoctor.com');
    const u = state.users[0]!;
    expect(u.role).toBe('SUPER_ADMIN');
    expect(u.status).toBe('ACTIVE');
    expect(u.passwordHash).not.toBe(base.password);
    expect(bcrypt.compareSync(base.password, u.passwordHash)).toBe(true);
    expect(u.passwordHash.startsWith(`$2`)).toBe(true);
    // cost 12 → hash segment $2b$12$ / $2a$12$
    expect(u.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(state.profiles[0]!.displayName).toBe('Boss');
  });

  it('refuses when a SUPER_ADMIN already exists', async () => {
    const state: State = {
      users: [{ id: 'x', email: 'other@p.com', phone: null, role: 'SUPER_ADMIN', status: 'ACTIVE', passwordHash: 'h' }],
      profiles: [],
      seq: 1,
    };
    await expect(createSuperAdmin(makeStore(state), base)).rejects.toThrow('already exists');
    expect(state.users).toHaveLength(1);
    expect(state.profiles).toHaveLength(0);
  });

  it('refuses when email already registered (non-admin)', async () => {
    const state: State = {
      users: [{ id: 'x', email: 'boss@pranidoctor.com', phone: null, role: 'CUSTOMER', status: 'ACTIVE', passwordHash: 'h' }],
      profiles: [],
      seq: 1,
    };
    await expect(createSuperAdmin(makeStore(state), base)).rejects.toThrow('already registered');
    expect(state.users).toHaveLength(1);
  });

  it('refuses when phone already registered', async () => {
    const state: State = {
      users: [{ id: 'x', email: 'other@p.com', phone: '+8801712345678', role: 'CUSTOMER', status: 'ACTIVE', passwordHash: 'h' }],
      profiles: [],
      seq: 1,
    };
    await expect(
      createSuperAdmin(makeStore(state), { ...base, phone: '01712345678' }),
    ).rejects.toThrow('mobile');
    expect(state.users).toHaveLength(1);
  });

  it('never returns the password or hash', async () => {
    const state: State = { users: [], profiles: [], seq: 0 };
    const res = await createSuperAdmin(makeStore(state), base);
    expect(JSON.stringify(res)).not.toContain(base.password);
    expect(JSON.stringify(res)).not.toContain('$2');
    expect(BCRYPT_COST).toBe(12);
  });
});
