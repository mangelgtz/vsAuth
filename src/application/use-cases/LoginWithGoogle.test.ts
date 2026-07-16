import { describe, it, expect, vi, beforeEach } from 'vitest';

import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { IPasswordHasher } from '../../domain/services/IPasswordHasher';
import { ITokenService } from '../../domain/services/ITokenService';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import { Password } from '../../domain/value-objects/Password';
import { IGoogleAuthPort } from '../ports/IGoogleAuthPort';
import { LoginWithGoogle } from './LoginWithGoogle';

const buildLocalUser = (): User => {
  const now = new Date();
  return User.create({
    id: 'user-1',
    email: Email.create('user@example.com'),
    name: 'User',
    passwordHash: Password.fromHash('hash'),
    googleId: null,
    provider: 'LOCAL',
    refreshTokenHash: null,
    refreshExpires: null,
    createdAt: now,
    updatedAt: now,
  });
};

describe('LoginWithGoogle', () => {
  let userRepository: IUserRepository;
  let googleAuthPort: IGoogleAuthPort;
  let passwordHasher: IPasswordHasher;
  let tokenService: ITokenService;
  let useCase: LoginWithGoogle;

  beforeEach(() => {
    userRepository = {
      findById: vi.fn(),
      findByEmail: vi.fn().mockResolvedValue(null),
      findByGoogleId: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (u: User) => u),
      update: vi.fn().mockImplementation(async (u: User) => u),
    };
    googleAuthPort = {
      getAuthorizationUrl: vi.fn().mockReturnValue('https://accounts.google.com/oauth'),
      exchangeCodeForProfile: vi.fn().mockResolvedValue({
        googleId: 'google-123',
        email: 'new@example.com',
        name: 'New Google User',
      }),
      verifyIdToken: vi.fn().mockResolvedValue({
        googleId: 'google-123',
        email: 'new@example.com',
        name: 'New Google User',
      }),
    };
    passwordHasher = {
      hash: vi.fn().mockResolvedValue('hash-of-refresh'),
      compare: vi.fn(),
    };
    tokenService = {
      signAccessToken: vi.fn().mockReturnValue('access'),
      signRefreshToken: vi
        .fn()
        .mockReturnValue({ token: 'refresh', expiresAt: new Date(Date.now() + 1_000_000) }),
      verifyAccessToken: vi.fn(),
      verifyRefreshToken: vi.fn(),
    };
    useCase = new LoginWithGoogle(userRepository, googleAuthPort, passwordHasher, tokenService);
  });

  describe('code flow (web / WebView)', () => {
    it('creates a new GOOGLE user when no match exists', async () => {
      const result = await useCase.execute({ type: 'code', code: 'oauth-code' });

      expect(googleAuthPort.exchangeCodeForProfile).toHaveBeenCalledWith('oauth-code');
      expect(googleAuthPort.verifyIdToken).not.toHaveBeenCalled();
      expect(userRepository.save).toHaveBeenCalled();
      expect(result.user.email).toBe('new@example.com');
    });

    it('links Google to an existing LOCAL user when emails match', async () => {
      (userRepository.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        buildLocalUser(),
      );

      const result = await useCase.execute({ type: 'code', code: 'oauth-code' });

      expect(userRepository.update).toHaveBeenCalled();
      expect(userRepository.save).not.toHaveBeenCalled();
      expect(result.accessToken).toBe('access');
    });

    it('reuses an existing GOOGLE user found by googleId', async () => {
      const existing = User.create({
        id: 'user-2',
        email: Email.create('new@example.com'),
        name: 'Already Google',
        passwordHash: null,
        googleId: 'google-123',
        provider: 'GOOGLE',
        refreshTokenHash: null,
        refreshExpires: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (userRepository.findByGoogleId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(existing);

      const result = await useCase.execute({ type: 'code', code: 'oauth-code' });

      expect(userRepository.save).not.toHaveBeenCalled();
      expect(result.user.id).toBe('user-2');
    });
  });

  describe('idToken flow (native mobile)', () => {
    it('uses verifyIdToken and never calls exchangeCodeForProfile', async () => {
      const result = await useCase.execute({ type: 'idToken', idToken: 'native.id.token' });

      expect(googleAuthPort.verifyIdToken).toHaveBeenCalledWith('native.id.token');
      expect(googleAuthPort.exchangeCodeForProfile).not.toHaveBeenCalled();
      expect(result.refreshToken).toBe('refresh');
    });
  });
});
