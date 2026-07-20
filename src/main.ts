/**
 * Composition root.
 *
 * This is the ONLY file allowed to know about every layer. It wires concrete
 * adapters to the ports they implement, builds the use cases, the controllers,
 * the Fastify instance, and starts the HTTP server.
 *
 * If you find yourself doing `new SomeAdapter()` anywhere else, you are
 * leaking infrastructure into a layer that should not know about it.
 */

import { loadEnv } from './infrastructure/config/env';
import { createPrismaClient } from './infrastructure/database/PrismaClientFactory';
import { PrismaUserRepository } from './infrastructure/database/repositories/PrismaUserRepository';
import { BcryptPasswordHasher } from './infrastructure/auth/BcryptPasswordHasher';
import { JwtTokenService } from './infrastructure/auth/JwtTokenService';
import { GoogleAuthAdapter } from './infrastructure/auth/GoogleAuthAdapter';

import { RegisterUser } from './application/use-cases/RegisterUser';
import { LoginWithPassword } from './application/use-cases/LoginWithPassword';
import { LoginWithGoogle } from './application/use-cases/LoginWithGoogle';
import { RefreshTokens } from './application/use-cases/RefreshTokens';
import { Logout } from './application/use-cases/Logout';
import { GetMe } from './application/use-cases/GetMe';

import { AuthController } from './interfaces/http/controllers/AuthController';
import { GoogleController } from './interfaces/http/controllers/GoogleController';
import { buildApp } from './interfaces/app';

const ACCESS_TTL_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const REFRESH_COOKIE_NAME = 'vp_refresh_token';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const isProduction = env.NODE_ENV === 'production';

  // ---- Infrastructure (concrete adapters) ----
  const prisma = createPrismaClient();
  const userRepository = new PrismaUserRepository(prisma);
  const passwordHasher = new BcryptPasswordHasher(12);
  const tokenService = new JwtTokenService({
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtlSeconds: ACCESS_TTL_SECONDS,
    refreshTtlSeconds: REFRESH_TTL_SECONDS,
    issuer: 'visionprice-auth',
  });
  const googleAuth = new GoogleAuthAdapter({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI,
    acceptedAudiences: env.GOOGLE_MOBILE_CLIENT_IDS,
  });

  // ---- Application (use cases) ----
  const registerUser = new RegisterUser(userRepository, passwordHasher, tokenService);
  const loginWithPassword = new LoginWithPassword(userRepository, passwordHasher, tokenService);
  const loginWithGoogle = new LoginWithGoogle(userRepository, googleAuth, passwordHasher, tokenService);
  const refreshTokens = new RefreshTokens(userRepository, passwordHasher, tokenService);
  const logout = new Logout(userRepository);
  const getMe = new GetMe(userRepository);

  // ---- Interfaces (HTTP controllers + Fastify app) ----
  const controllerConfig = {
    useCookie: env.REFRESH_TOKEN_COOKIE,
    isProduction,
    cookieName: REFRESH_COOKIE_NAME,
  };
  const authController = new AuthController(
    registerUser,
    loginWithPassword,
    refreshTokens,
    logout,
    getMe,
    controllerConfig,
  );
  const googleController = new GoogleController(googleAuth, loginWithGoogle, controllerConfig);

  const app = await buildApp({
    authController,
    googleController,
    tokenService,
    isProduction,
  });

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    app.log.info({ signal }, 'Shutting down');
    try {
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    // El healthcheck de Railway sondea por IPv4, por lo que el bind debe ser
    // '0.0.0.0' (todas las interfaces IPv4) y no '::'.
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`auth-service listening on :${env.PORT}`);
  } catch (err) {
    app.log.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

bootstrap().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
