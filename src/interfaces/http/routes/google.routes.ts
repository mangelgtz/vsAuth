import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { GoogleController } from '../controllers/GoogleController';

export interface GoogleRoutesDeps {
  readonly controller: GoogleController;
  readonly strictRateLimit: { max: number; timeWindow: string };
}

export const buildGoogleRoutes = (deps: GoogleRoutesDeps): FastifyPluginAsync => {
  return async (fastify: FastifyInstance): Promise<void> => {
    // Web / WebView flow
    fastify.get('/auth/google', deps.controller.start);
    fastify.get('/auth/google/callback', deps.controller.callback);

    // Native mobile flow (Flutter google_sign_in → idToken)
    fastify.post(
      '/auth/google/token',
      { config: { rateLimit: deps.strictRateLimit } },
      deps.controller.token,
    );
  };
};
