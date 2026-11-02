import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { User } from './entities/user.entity';
import { UsersRepository } from './users.repository';
import * as bcrypt from 'bcrypt';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { Role } from '../auth/roles/roles';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create(createUserDto: CreateUserDto) {
    const user = await this.usersRepository.create({
      ...createUserDto,
      password: await bcrypt.hash(createUserDto.password, 12),
    });
    return this.toPublicUser(user);
  }

 
  findAll() {
    return this.usersRepository.findAll();
  }

 
  async findOne(id: string, actor: AuthenticatedUser) {
    if (actor.role !== Role.Admin && actor.id.toLowerCase() !== id.toLowerCase()) {
      throw new ForbiddenException('Solo puedes consultar tu propio perfil');
    }
    const user = await this.usersRepository.findOne(id);
    if (!user) throw new NotFoundException(`No existe el usuario ${id}`);
    return user;
  }
  
  async update(id: string, updateUserDto: UpdateUserDto) {
    if (updateUserDto.password) {
      updateUserDto = {
        ...updateUserDto,
        password: await bcrypt.hash(updateUserDto.password, 12),
      };
    }
   
    const user = await this.usersRepository.update(id, updateUserDto);
    if (!user) throw new NotFoundException(`No existe el usuario ${id}`);
    return this.toPublicUser(user);
  }

  
  async remove(id: string) {
    const user = await this.usersRepository.findOne(id);
    if (!user) throw new NotFoundException(`No existe el usuario ${id}`);
    await this.usersRepository.remove(user);
    return { message: 'Usuario eliminado' };
  }

 
  private toPublicUser(user: User) {
    const { password: _password, admin: _admin, ...publicUser } = user;
    return publicUser;
  }
}
