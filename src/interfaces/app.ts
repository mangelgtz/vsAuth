import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import Fastify, { FastifyInstance } from 'fastify';

import { AuthController } from './http/controllers/AuthController';
import { GoogleController } from './http/controllers/GoogleController';
import { buildAuthGuard } from './http/middlewares/authGuard';
import { buildErrorHandler } from './http/middlewares/errorHandler';
import { buildAuthRoutes } from './http/routes/auth.routes';
import { buildGoogleRoutes } from './http/routes/google.routes';

import { ITokenService } from '../domain/services/ITokenService';

export interface AppOptions {
  readonly authController: AuthController;
  readonly googleController: GoogleController;
  readonly tokenService: ITokenService;
  readonly isProduction: boolean;
}

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: opts.isProduction ? 'info' : 'debug' },
    trustProxy: true,
    disableRequestLogging: false,
  });

  await app.register(fastifyHelmet, { contentSecurityPolicy: false });
  await app.register(fastifyCors, { origin: true, credentials: true });
  await app.register(fastifyCookie);
  await app.register(fastifyRateLimit, {
    global: false, // per-route only
  });

  app.setErrorHandler(buildErrorHandler({ isProduction: opts.isProduction }));

  app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }));

  const authGuard = buildAuthGuard(opts.tokenService);
  const strictRateLimit = { max: 10, timeWindow: '1 minute' };

  await app.register(
    buildAuthRoutes({
      controller: opts.authController,
      authGuard,
      strictRateLimit,
    }),
  );
  await app.register(
    buildGoogleRoutes({
      controller: opts.googleController,
      strictRateLimit,
    }),
  );

  return app;
}
