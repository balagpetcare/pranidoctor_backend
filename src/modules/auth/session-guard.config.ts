export function isPanelJwtSidEnabled(): boolean {
  const raw = process.env.PANEL_JWT_SID_ENABLED?.trim().toLowerCase();
  if (raw === 'false' || raw === '0') return false;
  return true;
}

export function isPanelSessionGuardEnabled(): boolean {
  const raw = process.env.PANEL_SESSION_GUARD_ENABLED?.trim().toLowerCase();
  if (raw === 'false' || raw === '0') return false;
  return true;
}

export function isMobileSessionGuardEnabled(): boolean {
  const raw = process.env.MOBILE_SESSION_GUARD_ENABLED?.trim().toLowerCase();
  if (raw === 'false' || raw === '0') return false;
  return true;
}
