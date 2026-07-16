import { AuthError } from '../../domain/errors/DomainError';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { IPasswordHasher } from '../../domain/services/IPasswordHasher';
import { ITokenService } from '../../domain/services/ITokenService';
import { Email } from '../../domain/value-objects/Email';
import { AuthResponseDto } from '../dtos/AuthResponseDto';
import { LoginDto } from '../dtos/LoginDto';

export class LoginWithPassword {
  public constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService,
  ) {}

  public async execute(dto: LoginDto): Promise<AuthResponseDto> {
    const email = Email.create(dto.email);
    const user = await this.userRepository.findByEmail(email);

    if (user === null || user.passwordHash === null) {
      throw new AuthError('Invalid credentials');
    }

    const ok = await this.passwordHasher.compare(dto.password, user.passwordHash.hash);
    if (!ok) {
      throw new AuthError('Invalid credentials');
    }

    const accessToken = this.tokenService.signAccessToken({ userId: user.id });
    const refresh = this.tokenService.signRefreshToken({ userId: user.id });
    const refreshHash = await this.passwordHasher.hash(refresh.token);

    const updated = await this.userRepository.update(
      user.withRefreshToken(refreshHash, refresh.expiresAt),
    );

    return {
      accessToken,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
      user: updated.toPublic(),
    };
  }
}
