/**
 * Outbound port for hashing and comparing secrets (passwords, refresh tokens).
 * Keeps bcrypt (or any other implementation) out of the domain layer.
 */
export interface IPasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}
