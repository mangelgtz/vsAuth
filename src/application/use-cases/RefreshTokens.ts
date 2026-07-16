import { AuthError } from '../../domain/errors/DomainError';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { IPasswordHasher } from '../../domain/services/IPasswordHasher';
import { ITokenService } from '../../domain/services/ITokenService';
import { AuthResponseDto } from '../dtos/AuthResponseDto';

export interface RefreshTokensInput {
  readonly refreshToken: string;
}

/**
 * Rotates a refresh token: verifies the incoming token, ensures it matches
 * the hashed version stored for the user, then issues a brand new pair and
 * overwrites the persisted hash.
 */
export class RefreshTokens {
  public constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService,
  ) {}

  public async execute(input: RefreshTokensInput): Promise<AuthResponseDto> {
    let payload: { userId: string };
    try {
      payload = this.tokenService.verifyRefreshToken(input.refreshToken);
    } catch {
      throw new AuthError('Invalid refresh token');
    }

    const user = await this.userRepository.findById(payload.userId);
    if (user === null || !user.hasValidRefreshSession()) {
      throw new AuthError('Refresh session expired');
    }
    if (user.refreshTokenHash === null) {
      throw new AuthError('Refresh session expired');
    }

    const matches = await this.passwordHasher.compare(input.refreshToken, user.refreshTokenHash);
    if (!matches) {
      // Token replay or tampering — invalidate the existing session for safety.
      await this.userRepository.update(user.withoutRefreshToken());
      throw new AuthError('Refresh token has been revoked');
    }

    const accessToken = this.tokenService.signAccessToken({ userId: user.id });
    const refresh = this.tokenService.signRefreshToken({ userId: user.id });
    const refreshHash = await this.passwordHasher.hash(refresh.token);

    const persisted = await this.userRepository.update(
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
