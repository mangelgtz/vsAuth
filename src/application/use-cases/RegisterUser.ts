import { randomUUID } from 'node:crypto';

import { User } from '../../domain/entities/User';
import { ConflictError } from '../../domain/errors/DomainError';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { IPasswordHasher } from '../../domain/services/IPasswordHasher';
import { ITokenService } from '../../domain/services/ITokenService';
import { Email } from '../../domain/value-objects/Email';
import { Password } from '../../domain/value-objects/Password';
import { AuthResponseDto } from '../dtos/AuthResponseDto';
import { RegisterDto } from '../dtos/RegisterDto';

export class RegisterUser {
  public constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService,
  ) {}

  public async execute(dto: RegisterDto): Promise<AuthResponseDto> {
    const email = Email.create(dto.email);
    const plain = Password.validatePlainText(dto.password);

    const existing = await this.userRepository.findByEmail(email);
    if (existing !== null) {
      throw new ConflictError('Email is already registered');
    }

    const passwordHash = Password.fromHash(await this.passwordHasher.hash(plain));

    const now = new Date();
    const user = User.create({
      id: randomUUID(),
      email,
      name: dto.name,
      passwordHash,
      googleId: null,
      provider: 'LOCAL',
      refreshTokenHash: null,
      refreshExpires: null,
      createdAt: now,
      updatedAt: now,
    });

    const accessToken = this.tokenService.signAccessToken({ userId: user.id });
    const refresh = this.tokenService.signRefreshToken({ userId: user.id });
    const refreshHash = await this.passwordHasher.hash(refresh.token);

    const persisted = await this.userRepository.save(
      user.withRefreshToken(refreshHash, refresh.expiresAt),
    );

    return {
      accessToken,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
      user: persisted.toPublic(),
    };
  }
}
