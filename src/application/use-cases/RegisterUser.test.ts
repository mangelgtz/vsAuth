import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ConflictError, ValidationError } from '../../domain/errors/DomainError';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { IPasswordHasher } from '../../domain/services/IPasswordHasher';
import { ITokenService } from '../../domain/services/ITokenService';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import { Password } from '../../domain/value-objects/Password';
import { RegisterUser } from './RegisterUser';

const buildUser = (overrides?: Partial<{ email: string }>): User => {
  const now = new Date();
  return User.create({
    id: 'existing-id',
    email: Email.create(overrides?.email ?? 'taken@example.com'),
    name: 'Taken',
    passwordHash: Password.fromHash('hashed'),
    googleId: null,
    provider: 'LOCAL',
    refreshTokenHash: null,
    refreshExpires: null,
    createdAt: now,
    updatedAt: now,
  });
};

describe('RegisterUser', () => {
  let userRepository: IUserRepository;
  let passwordHasher: IPasswordHasher;
  let tokenService: ITokenService;
  let useCase: RegisterUser;

  beforeEach(() => {
    userRepository = {
      findById: vi.fn(),
      findByEmail: vi.fn().mockResolvedValue(null),
      findByGoogleId: vi.fn(),
      save: vi.fn().mockImplementation(async (u: User) => u),
      update: vi.fn().mockImplementation(async (u: User) => u),
    };
    passwordHasher = {
      hash: vi.fn().mockResolvedValue('hashed-value'),
      compare: vi.fn().mockResolvedValue(true),
    };
    tokenService = {
      signAccessToken: vi.fn().mockReturnValue('access.jwt'),
      signRefreshToken: vi
        .fn()
        .mockReturnValue({ token: 'refresh.jwt', expiresAt: new Date(Date.now() + 1_000_000) }),
      verifyAccessToken: vi.fn(),
      verifyRefreshToken: vi.fn(),
    };
    useCase = new RegisterUser(userRepository, passwordHasher, tokenService);
  });

  it('creates a user and returns tokens when email is free', async () => {
    const result = await useCase.execute({
      email: 'new@example.com',
      password: 'StrongPass1',
      name: 'New User',
    });

    expect(userRepository.findByEmail).toHaveBeenCalled();
    expect(passwordHasher.hash).toHaveBeenCalled();
    expect(userRepository.save).toHaveBeenCalled();
    expect(result.accessToken).toBe('access.jwt');
    expect(result.refreshToken).toBe('refresh.jwt');
    expect(result.user.email).toBe('new@example.com');
  });

  it('rejects when email is already registered', async () => {
    (userRepository.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      buildUser({ email: 'new@example.com' }),
    );

    await expect(
      useCase.execute({
        email: 'new@example.com',
        password: 'StrongPass1',
        name: 'New User',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('rejects weak passwords', async () => {
    await expect(
      useCase.execute({
        email: 'new@example.com',
        password: 'weakpass',
        name: 'New User',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects invalid email format', async () => {
    await expect(
      useCase.execute({
        email: 'not-an-email',
        password: 'StrongPass1',
        name: 'New User',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
