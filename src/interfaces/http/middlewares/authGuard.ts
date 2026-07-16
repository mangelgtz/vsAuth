import { FastifyReply, FastifyRequest } from 'fastify';

import { AuthError } from '../../../domain/errors/DomainError';
import { ITokenService } from '../../../domain/services/ITokenService';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: { userId: string };
  }
}

/**
 * Returns a Fastify preHandler hook that validates `Authorization: Bearer
 * <accessToken>` against the given token service and attaches `request.auth`.
 */
export function buildAuthGuard(tokenService: ITokenService) {
  return async function authGuard(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    const header = request.headers.authorization;
    if (typeof header !== 'string' || !header.toLowerCase().startsWith('bearer ')) {
      throw new AuthError('Missing or malformed Authorization header');
    }
    const token = header.slice(7).trim();
    if (token.length === 0) {
      throw new AuthError('Missing access token');
    }
    const payload = tokenService.verifyAccessToken(token);
    request.auth = { userId: payload.userId };
  };
}
