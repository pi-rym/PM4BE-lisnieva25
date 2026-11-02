import { PartialType, ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsObject,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderProductDto {
  @ApiProperty({ format: 'uuid' })
  @IsNotEmpty()
  @IsUUID()
  id: string;
}

export class CreateOrderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    type: () => [CreateOrderProductDto],
    minItems: 1,
    description:
      'IDs de productos; se compra exactamente una unidad de cada uno',
  })

  @IsArray()
  @ArrayMinSize(1, {
    message: 'La orden debe contener al menos un producto',
  })
  @ValidateNested({ each: true })
  @IsObject({ each: true })
  @Type(() => CreateOrderProductDto)
  products: CreateOrderProductDto[];
}

export class UpdateOrderDto extends PartialType(CreateOrderDto, {
  skipNullProperties: false,
}) {}
