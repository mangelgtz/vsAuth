import { OAuth2Client } from 'google-auth-library';

import { AuthError } from '../../domain/errors/DomainError';
import { GoogleProfile, IGoogleAuthPort } from '../../application/ports/IGoogleAuthPort';

export interface GoogleAuthAdapterConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  /**
   * Audiences accepted when verifying an `id_token` issued by Google. In a
   * mobile + backend setup you normally include:
   *   - the WEB client_id of the backend (default, equal to `clientId`)
   *   - the ANDROID client_id used by the Flutter app
   *   - the iOS client_id used by the Flutter app
   */
  readonly acceptedAudiences?: ReadonlyArray<string>;
}

export class GoogleAuthAdapter implements IGoogleAuthPort {
  private readonly client: OAuth2Client;
  private readonly audiences: ReadonlyArray<string>;

  public constructor(private readonly config: GoogleAuthAdapterConfig) {
    this.client = new OAuth2Client({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    });
    const extra = config.acceptedAudiences ?? [];
    this.audiences = [config.clientId, ...extra.filter((a) => a !== config.clientId)];
  }

  public getAuthorizationUrl(state?: string): string {
    return this.client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['openid', 'email', 'profile'],
      state,
    });
  }

  public async exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
    let tokenResponse;
    try {
      tokenResponse = await this.client.getToken(code);
    } catch {
      throw new AuthError('Failed to exchange Google authorization code');
    }

    const idToken = tokenResponse.tokens.id_token;
    if (typeof idToken !== 'string' || idToken.length === 0) {
      throw new AuthError('Google did not return an id_token');
    }
    return this.verifyIdToken(idToken);
  }

  public async verifyIdToken(idToken: string): Promise<GoogleProfile> {
    let ticket;
    try {
      ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.audiences as string[],
      });
    } catch {
      throw new AuthError('Failed to verify Google id_token');
    }

    const payload = ticket.getPayload();
    if (payload === undefined || payload.sub === undefined || payload.email === undefined) {
      throw new AuthError('Google id_token missing required claims');
    }
    if (payload.email_verified === false) {
      throw new AuthError('Google email is not verified');
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email,
    };
  }
}
