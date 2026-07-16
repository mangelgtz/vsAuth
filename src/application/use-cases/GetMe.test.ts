import { describe, it, expect, vi, beforeEach } from 'vitest';

import { NotFoundError } from '../../domain/errors/DomainError';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import { Password } from '../../domain/value-objects/Password';
import { GetMe } from './GetMe';

describe('GetMe', () => {
  let userRepository: IUserRepository;
  let useCase: GetMe;

  beforeEach(() => {
    const now = new Date();
    userRepository = {
      findById: vi.fn().mockResolvedValue(
        User.create({
          id: 'user-1',
          email: Email.create('me@example.com'),
          name: 'Me',
          passwordHash: Password.fromHash('hash'),
          googleId: null,
          provider: 'LOCAL',
          refreshTokenHash: null,
          refreshExpires: null,
          createdAt: now,
          updatedAt: now,
        }),
      ),
      findByEmail: vi.fn(),
      findByGoogleId: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
    };
    useCase = new GetMe(userRepository);
  });

  it('returns the public profile for an existing user', async () => {
    const result = await useCase.execute({ userId: 'user-1' });
    expect(result).toEqual({ id: 'user-1', email: 'me@example.com', name: 'Me' });
  });

  it('throws NotFound when user does not exist', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(useCase.execute({ userId: 'missing' })).rejects.toBeInstanceOf(NotFoundError);
  });
});
