import { Prisma } from '../../generated/prisma/index.js';

const DB_KNOWN_REQUEST_CODES = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1003',
  'P1010',
  'P1011',
  'P1017',
]);

/** Classify Prisma/pg errors during panel login (no connection string leakage). */
export function isAuthDatabaseConnectivityError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return DB_KNOWN_REQUEST_CODES.has(error.code);
  }
  if (error instanceof Error) {
    const m = error.message.toLowerCase();
    if (m.includes('password authentication failed')) return true;
    if (m.includes('connection refused')) return true;
    if (m.includes('connect econnrefused')) return true;
    if (m.includes("can't reach database server")) return true;
    if (m.includes('the database server is not running')) return true;
    if (m.includes('server closed the connection')) return true;
    if (m.includes('timeout') && m.includes('connection')) return true;
  }
  return false;
}
