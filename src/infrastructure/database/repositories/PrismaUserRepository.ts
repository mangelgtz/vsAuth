import { PrismaClient, Provider as PrismaProvider, User as PrismaUser } from '@prisma/client';

import { User, ProviderType } from '../../../domain/entities/User';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { Email } from '../../../domain/value-objects/Email';
import { Password } from '../../../domain/value-objects/Password';

export class PrismaUserRepository implements IUserRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row === null ? null : PrismaUserRepository.toDomain(row);
  }

  public async findByEmail(email: Email): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email: email.value } });
    return row === null ? null : PrismaUserRepository.toDomain(row);
  }

  public async findByGoogleId(googleId: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { googleId } });
    return row === null ? null : PrismaUserRepository.toDomain(row);
  }

  public async save(user: User): Promise<User> {
    const row = await this.prisma.user.create({
      data: PrismaUserRepository.toPersistence(user),
    });
    return PrismaUserRepository.toDomain(row);
  }

  public async update(user: User): Promise<User> {
    const row = await this.prisma.user.update({
      where: { id: user.id },
      data: PrismaUserRepository.toPersistence(user),
    });
    return PrismaUserRepository.toDomain(row);
  }

  // -------- mappers --------

  private static toDomain(row: PrismaUser): User {
    return User.create({
      id: row.id,
      email: Email.create(row.email),
      name: row.name,
      passwordHash: row.passwordHash === null ? null : Password.fromHash(row.passwordHash),
      googleId: row.googleId,
      provider: PrismaUserRepository.providerFromPrisma(row.provider),
      refreshTokenHash: row.refreshToken,
      refreshExpires: row.refreshExpires,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private static toPersistence(user: User): {
    id: string;
    email: string;
    name: string;
    passwordHash: string | null;
    googleId: string | null;
    provider: PrismaProvider;
    refreshToken: string | null;
    refreshExpires: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: user.id,
      email: user.email.value,
      name: user.name,
      passwordHash: user.passwordHash === null ? null : user.passwordHash.hash,
      googleId: user.googleId,
      provider: PrismaUserRepository.providerToPrisma(user.provider),
      refreshToken: user.refreshTokenHash,
      refreshExpires: user.refreshExpires,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private static providerFromPrisma(value: PrismaProvider): ProviderType {
    return value === PrismaProvider.GOOGLE ? 'GOOGLE' : 'LOCAL';
  }

  private static providerToPrisma(value: ProviderType): PrismaProvider {
    return value === 'GOOGLE' ? PrismaProvider.GOOGLE : PrismaProvider.LOCAL;
  }
}
