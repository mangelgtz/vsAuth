import { FastifyInstance, FastifyPluginAsync, preHandlerHookHandler } from 'fastify';

import { AuthController } from '../controllers/AuthController';

export interface AuthRoutesDeps {
  readonly controller: AuthController;
  readonly authGuard: preHandlerHookHandler;
  readonly strictRateLimit: { max: number; timeWindow: string };
}

export const buildAuthRoutes = (deps: AuthRoutesDeps): FastifyPluginAsync => {
  return async (fastify: FastifyInstance): Promise<void> => {
    fastify.post(
      '/auth/register',
      { config: { rateLimit: deps.strictRateLimit } },
      deps.controller.register,
    );
    fastify.post(
      '/auth/login',
      { config: { rateLimit: deps.strictRateLimit } },
      deps.controller.login,
    );
    fastify.post('/auth/refresh', deps.controller.refresh);
    fastify.post(
      '/auth/logout',
      { preHandler: deps.authGuard },
      deps.controller.logoutHandler,
    );
    fastify.get(
      '/auth/me',
      { preHandler: deps.authGuard },
      deps.controller.me,
    );
  };
};
