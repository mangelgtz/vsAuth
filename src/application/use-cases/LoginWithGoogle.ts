import { randomUUID } from 'node:crypto';

import { User } from '../../domain/entities/User';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { IPasswordHasher } from '../../domain/services/IPasswordHasher';
import { ITokenService } from '../../domain/services/ITokenService';
import { Email } from '../../domain/value-objects/Email';
import { AuthResponseDto } from '../dtos/AuthResponseDto';
import { GoogleProfile, IGoogleAuthPort } from '../ports/IGoogleAuthPort';

export type LoginWithGoogleInput =
  | { readonly type: 'code'; readonly code: string }
  | { readonly type: 'idToken'; readonly idToken: string };

export class LoginWithGoogle {
  public constructor(
    private readonly userRepository: IUserRepository,
    private readonly googleAuthPort: IGoogleAuthPort,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService,
  ) {}

  public async execute(input: LoginWithGoogleInput): Promise<AuthResponseDto> {
    const profile = await this.resolveProfile(input);
    const email = Email.create(profile.email);

    let user =
      (await this.userRepository.findByGoogleId(profile.googleId)) ??
      (await this.userRepository.findByEmail(email));

    if (user === null) {
      const now = new Date();
      user = await this.userRepository.save(
        User.create({
          id: randomUUID(),
          email,
          name: profile.name,
          passwordHash: null,
          googleId: profile.googleId,
          provider: 'GOOGLE',
          refreshTokenHash: null,
          refreshExpires: null,
          createdAt: now,
          updatedAt: now,
        }),
      );
    } else if (user.googleId === null) {
      user = await this.userRepository.update(user.withGoogleLinked(profile.googleId));
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

  private resolveProfile(input: LoginWithGoogleInput): Promise<GoogleProfile> {
    switch (input.type) {
      case 'code':
        return this.googleAuthPort.exchangeCodeForProfile(input.code);
      case 'idToken':
        return this.googleAuthPort.verifyIdToken(input.idToken);
    }
  }
}
