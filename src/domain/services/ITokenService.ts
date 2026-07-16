export interface TokenPayload {
  readonly userId: string;
}

export interface SignedTokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly refreshExpiresAt: Date;
}

/**
 * Outbound port for signing and verifying authentication tokens. Concrete
 * implementations belong to the infrastructure layer (e.g. JWT, PASETO).
 */
export interface ITokenService {
  signAccessToken(payload: TokenPayload): string;
  signRefreshToken(payload: TokenPayload): { token: string; expiresAt: Date };
  verifyAccessToken(token: string): TokenPayload;
  verifyRefreshToken(token: string): TokenPayload;
}
