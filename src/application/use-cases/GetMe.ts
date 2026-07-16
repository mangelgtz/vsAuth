import { NotFoundError } from '../../domain/errors/DomainError';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { PublicUserDto } from '../dtos/AuthResponseDto';

export interface GetMeInput {
  readonly userId: string;
}

export class GetMe {
  public constructor(private readonly userRepository: IUserRepository) {}

  public async execute(input: GetMeInput): Promise<PublicUserDto> {
    const user = await this.userRepository.findById(input.userId);
    if (user === null) {
      throw new NotFoundError('User not found');
    }
    return user.toPublic();
  }
}
