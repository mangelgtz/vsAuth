export interface PublicUserDto {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

export interface AuthResponseDto {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly refreshExpiresAt: Date;
  readonly user: PublicUserDto;
}
