import { PrismaClient } from '@prisma/client';

/**
 * Tiny factory so the composition root owns a single Prisma client instance
 * and consumers don't accidentally instantiate their own.
 */
export function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn'],
  });
}
