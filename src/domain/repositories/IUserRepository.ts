import { User } from '../entities/User';
import { Email } from '../value-objects/Email';

/**
 * Outbound port: persistence of the User aggregate.
 * Implementations live in the infrastructure layer.
 */
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  findByGoogleId(googleId: string): Promise<User | null>;
  save(user: User): Promise<User>;
  update(user: User): Promise<User>;
}
