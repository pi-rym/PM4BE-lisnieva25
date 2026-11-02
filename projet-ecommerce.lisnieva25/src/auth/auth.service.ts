import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { LoginUserDto, SignupUserDto } from './dto/auth.dto';
import { User } from '../users/entities/user.entity';
import { UsersRepository } from '../users/users.repository';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from './roles/roles';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

  async signUp(signupUserDto: SignupUserDto) {
    const { confirmPassword, ...userData } = signupUserDto;
    if (
      !userData.password ||
      !confirmPassword ||
      userData.password !== confirmPassword
    ) {
      throw new BadRequestException(
        'Las contraseñas son obligatorias y deben coincidir',
      );
    }

    if (await this.usersRepository.existsByEmail(userData.email)) {
      throw new ConflictException('Ya existe un usuario con ese correo');
    }

    const password = await bcrypt.hash(userData.password, 12);
    const user = await this.usersRepository.create({ ...userData, password });
    return {
      user: this.toPublicUser(user),
      accessToken: await this.createAccessToken(user.id, user.admin),
    };
  }

  async signIn(loginUserDto: LoginUserDto) {
    const user = await this.usersRepository.findByEmailForAuth(
      loginUserDto.email,
    );

    if (
      !user ||
      !(await bcrypt.compare(loginUserDto.password, user.password))
    ) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    return {
      user: { id: user.id, email: user.email },
      accessToken: await this.createAccessToken(user.id, user.admin),
    };
  }

  private createAccessToken(id: string, isAdmin: boolean) {
    const payload = isAdmin ? { sub: id, role: Role.Admin } : { sub: id };
    return this.jwtService.signAsync(payload);
  }

  private toPublicUser(user: User) {
    const { password: _password, admin: _admin, ...publicUser } = user;
    return publicUser;
  }

  getStatus() {
    return { message: 'Servicio de autenticación disponible' };
  }
}
