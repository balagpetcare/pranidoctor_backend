import { isAuthDatabaseConnectivityError } from '../../../../modules/auth/db-connectivity.js';

/** JSON `error.code` values for `POST /api/admin/auth/login`. */
export type AdminLoginErrorCode =
  | "invalid_credentials"
  | "db_unavailable"
  | "server_error";

/** @deprecated Use `isAuthDatabaseConnectivityError` — kept for admin login call sites. */
export const isAdminLoginDatabaseConnectivityError = isAuthDatabaseConnectivityError;

/**
 * Safe structured logs for login failures (never password, JWT, cookies, or DATABASE_URL).
 */
export function logAdminLoginFailure(
  code: AdminLoginErrorCode,
  meta?: { prismaCode?: string },
): void {
  const line = `[pranidoctor][admin-login] failure code=${code}${
    meta?.prismaCode ? ` prismaCode=${meta.prismaCode}` : ""
  }`;
  if (code === "invalid_credentials") {
    console.info(line);
  } else {
    console.warn(line);
  }
}
