import { FastifyReply, FastifyRequest } from 'fastify';

import { AuthResponseDto } from '../../../application/dtos/AuthResponseDto';
import { IGoogleAuthPort } from '../../../application/ports/IGoogleAuthPort';
import { LoginWithGoogle } from '../../../application/use-cases/LoginWithGoogle';
import { GoogleCallbackQuerySchema, GoogleTokenBodySchema } from '../schemas/auth.schema';

export interface GoogleControllerConfig {
  readonly useCookie: boolean;
  readonly isProduction: boolean;
  readonly cookieName: string;
}

export class GoogleController {
  public constructor(
    private readonly googleAuthPort: IGoogleAuthPort,
    private readonly loginWithGoogle: LoginWithGoogle,
    private readonly config: GoogleControllerConfig,
  ) {}

  /** Web/WebView flow: redirect the browser to Google's consent screen. */
  public start = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const url = this.googleAuthPort.getAuthorizationUrl();
    reply.redirect(url, 302);
  };

  /** Web/WebView flow: Google redirects back here with `?code=...`. */
  public callback = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const query = GoogleCallbackQuerySchema.parse(request.query);
    const result = await this.loginWithGoogle.execute({ type: 'code', code: query.code });
    this.sendAuthResponse(reply, result);
  };

  /**
   * Native mobile flow: the device signs in with Google locally (Flutter
   * `google_sign_in` plugin) and POSTs the resulting `id_token` here. We
   * verify it against Google directly and issue our own tokens.
   */
  public token = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const body = GoogleTokenBodySchema.parse(request.body);
    const result = await this.loginWithGoogle.execute({ type: 'idToken', idToken: body.idToken });
    this.sendAuthResponse(reply, result);
  };

  private sendAuthResponse(reply: FastifyReply, result: AuthResponseDto): void {
    const body: Record<string, unknown> = {
      accessToken: result.accessToken,
      user: result.user,
    };
    if (this.config.useCookie) {
      reply.setCookie(this.config.cookieName, result.refreshToken, {
        httpOnly: true,
        secure: this.config.isProduction,
        sameSite: 'lax',
        path: '/',
        expires: result.refreshExpiresAt,
      });
    } else {
      body.refreshToken = result.refreshToken;
      body.refreshExpiresAt = result.refreshExpiresAt.toISOString();
    }
    reply.code(200).send(body);
  }
}
