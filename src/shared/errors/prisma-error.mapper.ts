import { Prisma } from '../../generated/prisma/index.js';

import { ConflictError, NotFoundError, BadRequestError, InternalServerError } from './http.errors.js';

export function mapPrismaError(error: unknown): Error | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }

  switch (error.code) {
    case 'P2002': {
      const target = Array.isArray(error.meta?.['target'])
        ? (error.meta?.['target'] as string[]).join(', ')
        : 'field';
      return new ConflictError('UNIQUE_CONSTRAINT', `Duplicate value for ${target}`, {
        fields: error.meta?.['target'],
      });
    }
    case 'P2003':
      return new BadRequestError('FOREIGN_KEY_CONSTRAINT', 'Related record not found', {
        field: error.meta?.['field_name'],
      });
    case 'P2025':
      return new NotFoundError('RECORD_NOT_FOUND', 'Record not found');
    default:
      return new InternalServerError(
        'DATABASE_ERROR',
        'Database operation failed',
        { prismaCode: error.code },
      );
  }
}
