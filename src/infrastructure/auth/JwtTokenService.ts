import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';

import { AuthError } from '../../domain/errors/DomainError';
import {
  ITokenService,
  TokenPayload,
} from '../../domain/services/ITokenService';

export interface JwtTokenServiceConfig {
  readonly accessSecret: string;
  readonly refreshSecret: string;
  readonly accessTtlSeconds: number;
  readonly refreshTtlSeconds: number;
  readonly issuer?: string;
}

export class JwtTokenService implements ITokenService {
  public constructor(private readonly config: JwtTokenServiceConfig) {}

  public signAccessToken(payload: TokenPayload): string {
    return jwt.sign({ sub: payload.userId }, this.config.accessSecret, this.signOptions(this.config.accessTtlSeconds));
  }

  public signRefreshToken(payload: TokenPayload): { token: string; expiresAt: Date } {
    const expiresAt = new Date(Date.now() + this.config.refreshTtlSeconds * 1000);
    const token = jwt.sign(
      { sub: payload.userId },
      this.config.refreshSecret,
      this.signOptions(this.config.refreshTtlSeconds),
    );
    return { token, expiresAt };
  }

  public verifyAccessToken(token: string): TokenPayload {
    return this.verify(token, this.config.accessSecret);
  }

  public verifyRefreshToken(token: string): TokenPayload {
    return this.verify(token, this.config.refreshSecret);
  }

  private verify(token: string, secret: string): TokenPayload {
    let decoded: string | JwtPayload;
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      throw new AuthError('Invalid or expired token');
    }
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
      throw new AuthError('Malformed token payload');
    }
    return { userId: decoded.sub };
  }

  private signOptions(expiresInSeconds: number): SignOptions {
    const options: SignOptions = {
      algorithm: 'HS256',
      expiresIn: expiresInSeconds,
    };
    if (this.config.issuer !== undefined) {
      options.issuer = this.config.issuer;
    }
    return options;
  }
}
