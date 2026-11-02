import { PartialType, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const MAX_DATABASE_INTEGER = 2147483647;
const MAX_MONEY_AMOUNT = 99999999.99;

export class CreateProductDto {
  @ApiProperty({ maxLength: 50, example: 'Iphone 15' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'El nombre no puede contener solo espacios' })
  @MinLength(1, { message: 'El nombre debe tener al menos 1 caracter' })
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: 'El mejor smartphone del mundo' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'La descripción no puede contener solo espacios' })
  description: string;

  @ApiProperty({
    type: Number,
    example: 199.99,
    minimum: 0,
    maximum: MAX_MONEY_AMOUNT,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  price: number;

  @ApiProperty({ example: 12, minimum: 0 })
  @IsInt()
  @Min(0, { message: 'El stock debe ser un número entero positivo' })
  @Max(MAX_DATABASE_INTEGER, {
    message: 'El stock no puede superar el valor máximo permitido',
  })
  stock: number;

  @ApiProperty({ format: 'uuid', description: 'Categoría existente' })
  @IsNotEmpty({ message: 'La categoría es obligatoria' })
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({
    format: 'url',
    example: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @ValidateIf((_object, value) => value !== undefined)
  @IsUrl({ require_protocol: true })
  imgUrl?: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto, {
  skipNullProperties: false,
}) {}

export class CatalogSeedResultDto {
  @ApiProperty({
    example: 'Precarga completada; los registros existentes se conservaron.',
  })
  message: string;

  @ApiProperty({ example: 4, minimum: 0 })
  categoriesCreated: number;

  @ApiProperty({ example: 12, minimum: 0 })
  productsCreated: number;
}
