import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { User } from './entities/user.entity';

const listFields = {
  id: true,
  name: true,
  email: true,
  phone: true,
  country: true,
  address: true,
  city: true,
  admin: true,
} as const;

const profileFields = {
  id: true,
  name: true,
  email: true,
  phone: true,
  country: true,
  address: true,
  city: true,
  orders: { id: true, date: true },
} as const;

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  create(dto: CreateUserDto) {
    return this.saveUser(this.users.create({ ...dto, admin: false }));
  }

  existsByEmail(email: string): Promise<boolean> {
    return this.users.exists({ where: { email } });
  }

  findByEmailForAuth(email: string): Promise<User | null> {
    return this.users.findOne({
      where: { email },
      select: { id: true, email: true, password: true, admin: true },
    });
  }

  findAll() {
    return this.users.find({ select: listFields, order: { name: 'ASC' } });
  }

  findOne(id: string) {
    return this.users.findOne({
      where: { id },
      relations: { orders: true },
      select: profileFields,
    });
  }

  async update(id: string, dto: UpdateUserDto): Promise<User | undefined> {
    const user = await this.users.preload({ id, ...dto });
    return user ? this.saveUser(user) : undefined;
  }

  remove(user: User) {
    return this.users.remove(user);
  }

  private async saveUser(user: User): Promise<User> {
    try {
      return await this.users.save(user);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        throw new ConflictException('Ya existe un usuario con ese correo');
      }
      throw error;
    }
  }
}
