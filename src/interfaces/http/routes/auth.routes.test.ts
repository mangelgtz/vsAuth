import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import supertest from 'supertest';
import { FastifyInstance } from 'fastify';

import { AuthController } from '../controllers/AuthController';
import { GoogleController } from '../controllers/GoogleController';
import { buildApp } from '../../app';
import { ITokenService } from '../../../domain/services/ITokenService';
import { IPasswordHasher } from '../../../domain/services/IPasswordHasher';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { IGoogleAuthPort } from '../../../application/ports/IGoogleAuthPort';
import { RegisterUser } from '../../../application/use-cases/RegisterUser';
import { LoginWithPassword } from '../../../application/use-cases/LoginWithPassword';
import { LoginWithGoogle } from '../../../application/use-cases/LoginWithGoogle';
import { RefreshTokens } from '../../../application/use-cases/RefreshTokens';
import { Logout } from '../../../application/use-cases/Logout';
import { GetMe } from '../../../application/use-cases/GetMe';
import { User } from '../../../domain/entities/User';
import { Email } from '../../../domain/value-objects/Email';
import { Password } from '../../../domain/value-objects/Password';

function makeInMemoryRepo(): IUserRepository {
  const store = new Map<string, User>();
  return {
    async findById(id) {
      return store.get(id) ?? null;
    },
    async findByEmail(email: Email) {
      for (const u of store.values()) {
        if (u.email.equals(email)) return u;
      }
      return null;
    },
    async findByGoogleId(googleId: string) {
      for (const u of store.values()) {
        if (u.googleId === googleId) return u;
      }
      return null;
    },
    async save(user) {
      store.set(user.id, user);
      return user;
    },
    async update(user) {
      store.set(user.id, user);
      return user;
    },
  };
}

function makeHasher(): IPasswordHasher {
  return {
    async hash(plain) {
      return `hash(${plain})`;
    },
    async compare(plain, hash) {
      return hash === `hash(${plain})`;
    },
  };
}

function makeTokenService(): ITokenService {
  return {
    signAccessToken: vi.fn().mockReturnValue('access.jwt'),
    signRefreshToken: vi
      .fn()
      .mockReturnValue({ token: 'refresh.jwt', expiresAt: new Date(Date.now() + 600_000) }),
    verifyAccessToken: vi.fn().mockReturnValue({ userId: 'user-1' }),
    verifyRefreshToken: vi.fn().mockReturnValue({ userId: 'user-1' }),
  };
}

function makeGoogleAuthPort(): IGoogleAuthPort {
  return {
    getAuthorizationUrl: vi.fn().mockReturnValue('https://accounts.google.com/oauth'),
    exchangeCodeForProfile: vi.fn().mockResolvedValue({
      googleId: 'g-1',
      email: 'g@example.com',
      name: 'G User',
    }),
    verifyIdToken: vi.fn().mockResolvedValue({
      googleId: 'g-1',
      email: 'g@example.com',
      name: 'G User',
    }),
  };
}

describe('Auth routes (integration)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const repo = makeInMemoryRepo();
    const hasher = makeHasher();
    const tokens = makeTokenService();
    const google = makeGoogleAuthPort();

    const registerUser = new RegisterUser(repo, hasher, tokens);
    const loginPassword = new LoginWithPassword(repo, hasher, tokens);
    const loginGoogle = new LoginWithGoogle(repo, google, hasher, tokens);
    const refresh = new RefreshTokens(repo, hasher, tokens);
    const logout = new Logout(repo);
    const getMe = new GetMe(repo);

    const authController = new AuthController(
      registerUser,
      loginPassword,
      refresh,
      logout,
      getMe,
      { useCookie: false, isProduction: false, cookieName: 'rt' },
    );
    const googleController = new GoogleController(google, loginGoogle, {
      useCookie: false,
      isProduction: false,
      cookieName: 'rt',
    });

    // Seed a user for me/logout
    const seeded = User.create({
      id: 'user-1',
      email: Email.create('seed@example.com'),
      name: 'Seed',
      passwordHash: Password.fromHash('hash(StrongPass1)'),
      googleId: null,
      provider: 'LOCAL',
      refreshTokenHash: 'hash(refresh.jwt)',
      refreshExpires: new Date(Date.now() + 600_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await repo.save(seeded);

    app = await buildApp({ authController, googleController, tokenService: tokens, isProduction: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns ok', async () => {
    const res = await supertest(app.server).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /auth/register creates a user and returns tokens', async () => {
    const res = await supertest(app.server)
      .post('/auth/register')
      .send({ email: 'new@example.com', password: 'StrongPass1', name: 'New' });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe('new@example.com');
  });

  it('POST /auth/register rejects duplicate emails', async () => {
    const res = await supertest(app.server)
      .post('/auth/register')
      .send({ email: 'seed@example.com', password: 'StrongPass1', name: 'Dup' });
    expect(res.status).toBe(409);
  });

  it('POST /auth/login returns tokens for valid credentials', async () => {
    const res = await supertest(app.server)
      .post('/auth/login')
      .send({ email: 'seed@example.com', password: 'StrongPass1' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('access.jwt');
  });

  it('POST /auth/login rejects bad credentials', async () => {
    const res = await supertest(app.server)
      .post('/auth/login')
      .send({ email: 'seed@example.com', password: 'WrongPass1' });
    expect(res.status).toBe(401);
  });

  it('GET /auth/me requires a Bearer token', async () => {
    const res = await supertest(app.server).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /auth/me returns the profile when authenticated', async () => {
    const res = await supertest(app.server)
      .get('/auth/me')
      .set('Authorization', 'Bearer some.access.token');
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('user-1');
  });

  it('POST /auth/logout invalidates the session', async () => {
    const res = await supertest(app.server)
      .post('/auth/logout')
      .set('Authorization', 'Bearer some.access.token');
    expect(res.status).toBe(204);
  });

  it('GET /auth/google redirects to the consent screen', async () => {
    const res = await supertest(app.server).get('/auth/google').redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('accounts.google.com');
  });

  it('POST /auth/google/token verifies idToken and returns tokens', async () => {
    const res = await supertest(app.server)
      .post('/auth/google/token')
      .send({ idToken: 'eyJ.fake.native-id-token-long-enough' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('access.jwt');
    expect(res.body.user.email).toBe('g@example.com');
  });

  it('POST /auth/google/token rejects empty body', async () => {
    const res = await supertest(app.server).post('/auth/google/token').send({});
    expect(res.status).toBe(400);
  });
});
