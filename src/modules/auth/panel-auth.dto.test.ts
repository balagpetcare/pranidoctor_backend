import { describe, expect, it } from 'vitest';

import { toDoctorMeUser, toTechnicianMeUser } from './panel-auth.dto.js';

describe('panel-auth.dto', () => {
  it('maps doctor actor to me user with id', () => {
    const dto = toDoctorMeUser({
      userId: 'user-1',
      doctorProfileId: 'prof-1',
      email: 'd@test.com',
      displayName: 'Doc',
      providerStatus: 'ACTIVE',
    });
    expect(dto.id).toBe('user-1');
    expect(dto.doctorProfileId).toBe('prof-1');
    expect(dto.role).toBe('DOCTOR');
    expect(dto.providerStatus).toBe('ACTIVE');
    expect((dto as { userId?: string }).userId).toBeUndefined();
  });

  it('maps technician actor to me user with id', () => {
    const dto = toTechnicianMeUser({
      userId: 'user-2',
      aiTechnicianProfileId: 'prof-2',
      email: 't@test.com',
      displayName: null,
      providerStatus: 'ACTIVE',
    });
    expect(dto.id).toBe('user-2');
    expect(dto.aiTechnicianProfileId).toBe('prof-2');
    expect(dto.role).toBe('AI_TECHNICIAN');
  });
});
