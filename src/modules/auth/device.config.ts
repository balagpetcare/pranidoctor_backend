export function isDeviceRegisterBindSessionEnabled(): boolean {
  const raw = process.env.DEVICE_REGISTER_BIND_SESSION?.trim().toLowerCase();
  if (raw === 'false' || raw === '0') return false;
  return true;
}

export function isRefreshRejectRevokedDeviceEnabled(): boolean {
  const raw = process.env.REFRESH_REJECT_REVOKED_DEVICE?.trim().toLowerCase();
  return raw === 'true' || raw === '1';
}

export function isDeviceRevokeCascadeSessionsEnabled(): boolean {
  const raw = process.env.DEVICE_REVOKE_CASCADE_SESSIONS?.trim().toLowerCase();
  if (raw === 'false' || raw === '0') return false;
  return true;
}
