import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AuthError } from '../../domain/errors/DomainError';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { IPasswordHasher } from '../../domain/services/IPasswordHasher';
import { ITokenService } from '../../domain/services/ITokenService';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import { Password } from '../../domain/value-objects/Password';
import { RefreshTokens } from './RefreshTokens';

const buildUserWithSession = (): User => {
  const now = new Date();
  return User.create({
    id: 'user-1',
    email: Email.create('user@example.com'),
    name: 'User',
    passwordHash: Password.fromHash('hash'),
    googleId: null,
    provider: 'LOCAL',
    refreshTokenHash: 'old-refresh-hash',
    refreshExpires: new Date(Date.now() + 60_000),
    createdAt: now,
    updatedAt: now,
  });
};

describe('RefreshTokens', () => {
  let userRepository: IUserRepository;
  let passwordHasher: IPasswordHasher;
  let tokenService: ITokenService;
  let useCase: RefreshTokens;

  beforeEach(() => {
    userRepository = {
      findById: vi.fn().mockResolvedValue(buildUserWithSession()),
      findByEmail: vi.fn(),
      findByGoogleId: vi.fn(),
      save: vi.fn(),
      update: vi.fn().mockImplementation(async (u: User) => u),
    };
    passwordHasher = {
      hash: vi.fn().mockResolvedValue('new-refresh-hash'),
      compare: vi.fn().mockResolvedValue(true),
    };
    tokenService = {
      signAccessToken: vi.fn().mockReturnValue('new-access'),
      signRefreshToken: vi
        .fn()
        .mockReturnValue({ token: 'new-refresh', expiresAt: new Date(Date.now() + 600_000) }),
      verifyAccessToken: vi.fn(),
      verifyRefreshToken: vi.fn().mockReturnValue({ userId: 'user-1' }),
    };
    useCase = new RefreshTokens(userRepository, passwordHasher, tokenService);
  });

  it('rotates tokens when refresh is valid', async () => {
    const result = await useCase.execute({ refreshToken: 'old-refresh' });

    expect(result.accessToken).toBe('new-access');
    expect(result.refreshToken).toBe('new-refresh');
    expect(userRepository.update).toHaveBeenCalled();
  });

  it('rejects malformed refresh tokens', async () => {
    (tokenService.verifyRefreshToken as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('jwt malformed');
    });

    await expect(useCase.execute({ refreshToken: 'bad' })).rejects.toBeInstanceOf(AuthError);
  });

  it('rejects when stored hash does not match (replay)', async () => {
    (passwordHasher.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

    await expect(useCase.execute({ refreshToken: 'replay' })).rejects.toBeInstanceOf(AuthError);
    expect(userRepository.update).toHaveBeenCalled(); // invalidation of stored session
  });

  it('rejects when user has no active refresh session', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    await expect(useCase.execute({ refreshToken: 'whatever' })).rejects.toBeInstanceOf(AuthError);
  });
});
