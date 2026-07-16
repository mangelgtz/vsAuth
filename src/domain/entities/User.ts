import { Email } from '../value-objects/Email';
import { Password } from '../value-objects/Password';
import { ValidationError } from '../errors/DomainError';

export type ProviderType = 'LOCAL' | 'GOOGLE';

export interface UserProps {
  readonly id: string;
  readonly email: Email;
  readonly name: string;
  readonly passwordHash: Password | null;
  readonly googleId: string | null;
  readonly provider: ProviderType;
  readonly refreshTokenHash: string | null;
  readonly refreshExpires: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Pure domain entity. No ORM decorators, no framework imports.
 * Behaviour is exposed through immutable mutator methods that return new
 * instances of `User`.
 */
export class User {
  public readonly id: string;
  public readonly email: Email;
  public readonly name: string;
  public readonly passwordHash: Password | null;
  public readonly googleId: string | null;
  public readonly provider: ProviderType;
  public readonly refreshTokenHash: string | null;
  public readonly refreshExpires: Date | null;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private constructor(props: UserProps) {
    if (props.name.trim().length === 0) {
      throw new ValidationError('Name cannot be empty');
    }
    if (props.provider === 'LOCAL' && props.passwordHash === null) {
      throw new ValidationError('LOCAL users must have a password');
    }
    if (props.provider === 'GOOGLE' && props.googleId === null) {
      throw new ValidationError('GOOGLE users must have a googleId');
    }
    this.id = props.id;
    this.email = props.email;
    this.name = props.name.trim();
    this.passwordHash = props.passwordHash;
    this.googleId = props.googleId;
    this.provider = props.provider;
    this.refreshTokenHash = props.refreshTokenHash;
    this.refreshExpires = props.refreshExpires;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public static create(props: UserProps): User {
    return new User(props);
  }

  public withRefreshToken(hash: string, expiresAt: Date): User {
    return new User({
      ...this.snapshot(),
      refreshTokenHash: hash,
      refreshExpires: expiresAt,
      updatedAt: new Date(),
    });
  }

  public withoutRefreshToken(): User {
    return new User({
      ...this.snapshot(),
      refreshTokenHash: null,
      refreshExpires: null,
      updatedAt: new Date(),
    });
  }

  public withGoogleLinked(googleId: string): User {
    return new User({
      ...this.snapshot(),
      googleId,
      provider: this.provider === 'GOOGLE' ? 'GOOGLE' : this.provider,
      updatedAt: new Date(),
    });
  }

  public hasValidRefreshSession(now: Date = new Date()): boolean {
    if (this.refreshTokenHash === null || this.refreshExpires === null) {
      return false;
    }
    return this.refreshExpires.getTime() > now.getTime();
  }

  public toPublic(): { id: string; email: string; name: string } {
    return {
      id: this.id,
      email: this.email.value,
      name: this.name,
    };
  }

  private snapshot(): UserProps {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      passwordHash: this.passwordHash,
      googleId: this.googleId,
      provider: this.provider,
      refreshTokenHash: this.refreshTokenHash,
      refreshExpires: this.refreshExpires,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
