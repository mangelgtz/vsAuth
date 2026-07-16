import bcrypt from 'bcrypt';

import { IPasswordHasher } from '../../domain/services/IPasswordHasher';

export class BcryptPasswordHasher implements IPasswordHasher {
  public constructor(private readonly rounds: number = 12) {}

  public async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }

  public async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
