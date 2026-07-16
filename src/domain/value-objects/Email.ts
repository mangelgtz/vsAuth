import { ValidationError } from '../errors/DomainError';

/**
 * Immutable Email value object. The only way to construct an Email is through
 * the static `create` factory, which enforces a syntactic validation.
 */
export class Email {
  private static readonly EMAIL_REGEX =
    /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

  private constructor(public readonly value: string) {}

  public static create(raw: string): Email {
    if (typeof raw !== 'string') {
      throw new ValidationError('Email must be a string');
    }
    const normalized = raw.trim().toLowerCase();
    if (normalized.length === 0) {
      throw new ValidationError('Email cannot be empty');
    }
    if (normalized.length > 254) {
      throw new ValidationError('Email is too long');
    }
    if (!Email.EMAIL_REGEX.test(normalized)) {
      throw new ValidationError('Email format is invalid');
    }
    return new Email(normalized);
  }

  public equals(other: Email): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}
