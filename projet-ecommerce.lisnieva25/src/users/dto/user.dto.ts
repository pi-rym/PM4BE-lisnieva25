import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const MIN_DATABASE_INTEGER = -2147483648;
const MAX_DATABASE_INTEGER = 2147483647;

export class CreateUserDto {
  @ApiProperty({ minLength: 3, maxLength: 50, example: 'Ana Perez' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'El nombre no puede contener solo espacios' })
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @ApiProperty({ maxLength: 50, example: 'ana@correo.com' })
  @IsEmail()
  @MaxLength(50)
  email: string;

  @ApiProperty({
    minLength: 8,
    maxLength: 15,
    format: 'password',
    description:
      'Debe incluir minúscula, mayúscula, número y carácter especial',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,15}$/, {
    message:
      'La contraseña debe tener entre 8 y 15 caracteres, una minúscula, una mayúscula, un número y un carácter especial de !@#$%^&*',
  })
  password: string;

  @ApiProperty({ minLength: 3, maxLength: 80, example: 'Calle 123' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'La dirección no puede contener solo espacios' })
  @MinLength(3)
  @MaxLength(80)
  address: string;

  @ApiProperty({
    example: 1122334455,
    minimum: MIN_DATABASE_INTEGER,
    maximum: MAX_DATABASE_INTEGER,
  })
  @IsInt()
  @IsNotEmpty()
  @Min(MIN_DATABASE_INTEGER)
  @Max(MAX_DATABASE_INTEGER)
  phone: number;

  @ApiProperty({ minLength: 5, maxLength: 20, example: 'Argentina' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'El país no puede contener solo espacios' })
  @MinLength(5)
  @MaxLength(20)
  country: string;

  @ApiProperty({ minLength: 5, maxLength: 20, example: 'Buenos Aires' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'La ciudad no puede contener solo espacios' })
  @MinLength(5)
  @MaxLength(20)
  city: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto, {
  skipNullProperties: false,
}) {}
