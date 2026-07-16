import { describe, it, expect, vi, beforeEach } from 'vitest';

import { NotFoundError } from '../../domain/errors/DomainError';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import { Password } from '../../domain/value-objects/Password';
import { Logout } from './Logout';

const buildUser = (): User => {
  const now = new Date();
  return User.create({
    id: 'user-1',
    email: Email.create('user@example.com'),
    name: 'User',
    passwordHash: Password.fromHash('hash'),
    googleId: null,
    provider: 'LOCAL',
    refreshTokenHash: 'stored',
    refreshExpires: new Date(Date.now() + 60_000),
    createdAt: now,
    updatedAt: now,
  });
};

describe('Logout', () => {
  let userRepository: IUserRepository;
  let useCase: Logout;

  beforeEach(() => {
    userRepository = {
      findById: vi.fn().mockResolvedValue(buildUser()),
      findByEmail: vi.fn(),
      findByGoogleId: vi.fn(),
      save: vi.fn(),
      update: vi.fn().mockImplementation(async (u: User) => u),
    };
    useCase = new Logout(userRepository);
  });

  it('clears the refresh session for an existing user', async () => {
    await useCase.execute({ userId: 'user-1' });

    const updated = (userRepository.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as User;
    expect(updated.refreshTokenHash).toBeNull();
    expect(updated.refreshExpires).toBeNull();
  });

  it('throws NotFound when user does not exist', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(useCase.execute({ userId: 'missing' })).rejects.toBeInstanceOf(NotFoundError);
  });
});
