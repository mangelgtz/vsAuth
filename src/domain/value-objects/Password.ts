import { ValidationError } from '../errors/DomainError';

/**
 * Immutable Password value object representing a HASHED password.
 *
 * The class exposes two factories:
 *   - `validatePlainText(raw)`: validates strength rules of a plaintext value
 *     and returns the same string for the infrastructure layer to hash.
 *   - `fromHash(hash)`: wraps an already-hashed value in the value object.
 *
 * Domain layer NEVER touches bcrypt directly — hashing is delegated to the
 * `IPasswordHasher` port implemented in infrastructure.
 */
export class Password {
  private static readonly STRENGTH_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

  private constructor(public readonly hash: string) {}

  /**
   * Validates a plaintext password against the strength policy. Throws
   * `ValidationError` if it does not comply. Returns the plaintext to be
   * hashed by the infrastructure adapter.
   */
  public static validatePlainText(raw: string): string {
    if (typeof raw !== 'string') {
      throw new ValidationError('Password must be a string');
    }
    if (raw.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }
    if (raw.length > 128) {
      throw new ValidationError('Password must be at most 128 characters long');
    }
    if (!Password.STRENGTH_REGEX.test(raw)) {
      throw new ValidationError(
        'Password must contain at least 1 uppercase letter and 1 number',
      );
    }
    return raw;
  }

  public static fromHash(hash: string): Password {
    if (typeof hash !== 'string' || hash.length === 0) {
      throw new ValidationError('Password hash cannot be empty');
    }
    return new Password(hash);
  }
}
