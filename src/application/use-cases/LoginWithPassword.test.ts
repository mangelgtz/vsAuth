import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AuthError } from '../../domain/errors/DomainError';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { IPasswordHasher } from '../../domain/services/IPasswordHasher';
import { ITokenService } from '../../domain/services/ITokenService';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import { Password } from '../../domain/value-objects/Password';
import { LoginWithPassword } from './LoginWithPassword';

const buildUser = (props?: { passwordHash?: Password | null }): User => {
  const now = new Date();
  return User.create({
    id: 'user-1',
    email: Email.create('user@example.com'),
    name: 'User',
    passwordHash: props?.passwordHash === undefined
      ? Password.fromHash('stored-hash')
      : props.passwordHash,
    googleId: null,
    provider: 'LOCAL',
    refreshTokenHash: null,
    refreshExpires: null,
    createdAt: now,
    updatedAt: now,
  });
};

describe('LoginWithPassword', () => {
  let userRepository: IUserRepository;
  let passwordHasher: IPasswordHasher;
  let tokenService: ITokenService;
  let useCase: LoginWithPassword;

  beforeEach(() => {
    userRepository = {
      findById: vi.fn(),
      findByEmail: vi.fn().mockResolvedValue(buildUser()),
      findByGoogleId: vi.fn(),
      save: vi.fn(),
      update: vi.fn().mockImplementation(async (u: User) => u),
    };
    passwordHasher = {
      hash: vi.fn().mockResolvedValue('new-hash'),
      compare: vi.fn().mockResolvedValue(true),
    };
    tokenService = {
      signAccessToken: vi.fn().mockReturnValue('access'),
      signRefreshToken: vi
        .fn()
        .mockReturnValue({ token: 'refresh', expiresAt: new Date(Date.now() + 1_000_000) }),
      verifyAccessToken: vi.fn(),
      verifyRefreshToken: vi.fn(),
    };
    useCase = new LoginWithPassword(userRepository, passwordHasher, tokenService);
  });

  it('returns tokens on valid credentials', async () => {
    const result = await useCase.execute({
      email: 'user@example.com',
      password: 'StrongPass1',
    });

    expect(result.accessToken).toBe('access');
    expect(result.refreshToken).toBe('refresh');
    expect(userRepository.update).toHaveBeenCalled();
  });

  it('rejects when user does not exist', async () => {
    (userRepository.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(
      useCase.execute({ email: 'user@example.com', password: 'StrongPass1' }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it('rejects when user has no password (Google-only account)', async () => {
    (userRepository.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      buildUser({ passwordHash: null }),
    );
    await expect(
      useCase.execute({ email: 'user@example.com', password: 'StrongPass1' }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it('rejects when password does not match', async () => {
    (passwordHasher.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    await expect(
      useCase.execute({ email: 'user@example.com', password: 'StrongPass1' }),
    ).rejects.toBeInstanceOf(AuthError);
  });
});
