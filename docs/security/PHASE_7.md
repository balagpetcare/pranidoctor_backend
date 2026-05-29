# Backend security — Phase 7

See `pranidoctor_user/docs/security/PHASE_7_SECURITY_HARDENING.md` for cross-repo controls.

## Backend-specific

- Rate limits: `src/shared/security/rate-limit/`
- Probe exemption: `src/shared/security/rate-limit/probe-exempt.ts`
- Sentry: set `SENTRY_DSN` in production `.env`
- Production migrate guard: `scripts/prisma-production-guard.mjs`
