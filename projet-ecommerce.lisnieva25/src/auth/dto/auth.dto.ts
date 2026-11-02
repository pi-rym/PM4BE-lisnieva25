import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CreateUserDto } from '../../users/dto/user.dto';

export class LoginUserDto {
  @ApiProperty({ example: 'persona@correo.com', maxLength: 50 })
  @IsEmail()
  @MaxLength(50)
  email: string;

  @ApiProperty({ example: 'ClaveSegura1!', maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  password: string;
}

export class SignupUserDto extends CreateUserDto {
  @ApiProperty({
    example: 'ClaveSegura1!',
    description: 'Debe coincidir con password',
  })
  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}
