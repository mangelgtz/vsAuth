/**
 * Base class for any error originating from the domain or application layer.
 * The HTTP layer maps these to specific status codes.
 */
export abstract class DomainError extends Error {
  public abstract readonly code: string;
  public abstract readonly httpStatus: number;

  protected constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON(): { error: string; code: string; message: string } {
    return {
      error: this.name,
      code: this.code,
      message: this.message,
    };
  }
}

export class ValidationError extends DomainError {
  public readonly code = 'VALIDATION_ERROR';
  public readonly httpStatus = 400;

  public constructor(message: string) {
    super(message);
  }
}

export class AuthError extends DomainError {
  public readonly code = 'AUTH_ERROR';
  public readonly httpStatus = 401;

  public constructor(message = 'Invalid credentials') {
    super(message);
  }
}

export class ForbiddenError extends DomainError {
  public readonly code = 'FORBIDDEN';
  public readonly httpStatus = 403;

  public constructor(message = 'Forbidden') {
    super(message);
  }
}

export class NotFoundError extends DomainError {
  public readonly code = 'NOT_FOUND';
  public readonly httpStatus = 404;

  public constructor(message = 'Resource not found') {
    super(message);
  }
}

export class ConflictError extends DomainError {
  public readonly code = 'CONFLICT';
  public readonly httpStatus = 409;

  public constructor(message: string) {
    super(message);
  }
}
