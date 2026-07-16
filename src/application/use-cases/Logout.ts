import { NotFoundError } from '../../domain/errors/DomainError';
import { IUserRepository } from '../../domain/repositories/IUserRepository';

export interface LogoutInput {
  readonly userId: string;
}

export class Logout {
  public constructor(private readonly userRepository: IUserRepository) {}

  public async execute(input: LogoutInput): Promise<void> {
    const user = await this.userRepository.findById(input.userId);
    if (user === null) {
      throw new NotFoundError('User not found');
    }
    await this.userRepository.update(user.withoutRefreshToken());
  }
}
