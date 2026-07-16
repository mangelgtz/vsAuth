import { FastifyReply, FastifyRequest } from 'fastify';

import { AuthError } from '../../../domain/errors/DomainError';
import { AuthResponseDto } from '../../../application/dtos/AuthResponseDto';
import { GetMe } from '../../../application/use-cases/GetMe';
import { LoginWithPassword } from '../../../application/use-cases/LoginWithPassword';
import { Logout } from '../../../application/use-cases/Logout';
import { RefreshTokens } from '../../../application/use-cases/RefreshTokens';
import { RegisterUser } from '../../../application/use-cases/RegisterUser';
import {
  LoginBodySchema,
  RefreshBodySchema,
  RegisterBodySchema,
} from '../schemas/auth.schema';

export interface AuthControllerConfig {
  readonly useCookie: boolean;
  readonly isProduction: boolean;
  readonly cookieName: string;
}

export class AuthController {
  public constructor(
    private readonly registerUser: RegisterUser,
    private readonly loginWithPassword: LoginWithPassword,
    private readonly refreshTokens: RefreshTokens,
    private readonly logout: Logout,
    private readonly getMe: GetMe,
    private readonly config: AuthControllerConfig,
  ) {}

  public register = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const body = RegisterBodySchema.parse(request.body);
    const result = await this.registerUser.execute(body);
    this.sendAuthResponse(reply, result, 201);
  };

  public login = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const body = LoginBodySchema.parse(request.body);
    const result = await this.loginWithPassword.execute(body);
    this.sendAuthResponse(reply, result, 200);
  };

  public refresh = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const body = RefreshBodySchema.parse(request.body ?? {});
    const cookieToken = request.cookies?.[this.config.cookieName];
    const token = body.refreshToken ?? cookieToken;
    if (token === undefined || token.length === 0) {
      throw new AuthError('Missing refresh token');
    }
    const result = await this.refreshTokens.execute({ refreshToken: token });
    this.sendAuthResponse(reply, result, 200);
  };

  public logoutHandler = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (request.auth === undefined) {
      throw new AuthError('Not authenticated');
    }
    await this.logout.execute({ userId: request.auth.userId });
    if (this.config.useCookie) {
      reply.clearCookie(this.config.cookieName, { path: '/' });
    }
    reply.code(204).send();
  };

  public me = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (request.auth === undefined) {
      throw new AuthError('Not authenticated');
    }
    const user = await this.getMe.execute({ userId: request.auth.userId });
    reply.send({ user });
  };

  // ---------- helpers ----------

  private sendAuthResponse(reply: FastifyReply, result: AuthResponseDto, status: number): void {
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
    reply.code(status).send(body);
  }
}
