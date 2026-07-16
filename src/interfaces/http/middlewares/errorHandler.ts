import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

import { DomainError } from '../../../domain/errors/DomainError';

interface ErrorBody {
  error: string;
  code: string;
  message: string;
  details?: unknown;
}

export function buildErrorHandler(opts: { isProduction: boolean }) {
  return function errorHandler(
    error: FastifyError | Error,
    request: FastifyRequest,
    reply: FastifyReply,
  ): void {
    if (error instanceof ZodError) {
      const body: ErrorBody = {
        error: 'ValidationError',
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: error.issues.map((i) => ({ path: i.path, message: i.message })),
      };
      reply.code(400).send(body);
      return;
    }

    if (error instanceof DomainError) {
      const body: ErrorBody = error.toJSON();
      reply.code(error.httpStatus).send(body);
      return;
    }

    const fastifyError = error as FastifyError;
    if (fastifyError.statusCode !== undefined && fastifyError.statusCode < 500) {
      const body: ErrorBody = {
        error: fastifyError.name || 'BadRequest',
        code: fastifyError.code ?? 'BAD_REQUEST',
        message: fastifyError.message,
      };
      reply.code(fastifyError.statusCode).send(body);
      return;
    }

    request.log.error({ err: error }, 'Unhandled error');
    const body: ErrorBody = {
      error: 'InternalServerError',
      code: 'INTERNAL_ERROR',
      message: opts.isProduction ? 'Something went wrong' : error.message,
    };
    reply.code(500).send(body);
  };
}
