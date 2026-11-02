import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import type { ClassConstructor } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateUserDto, UpdateUserDto } from '../src/users/dto/user.dto';
import {
  CreateProductDto,
  UpdateProductDto,
} from '../src/products/dto/product.dto';
import { UpdateCategoryDto } from '../src/categories/dto/category.dto';
import { CreateOrderDto, UpdateOrderDto } from '../src/orders/dto/order.dto';
import {
  ImageSizeValidator,
  MAX_IMAGE_SIZE,
} from '../src/files/validators/image-size.validator';

const user = {
  name: 'Ana Perez',
  email: 'ana@correo.com',
  password: 'Clave123!',
  phone: 1122334455,
  address: 'Calle 123',
  country: 'Argentina',
  city: 'Buenos Aires',
};
const product = {
  name: 'Producto',
  description: 'Descripción',
  price: 12.5,
  stock: 2,
  categoryId: '123e4567-e89b-42d3-a456-426614174000',
};
const partialDtos: [string, ClassConstructor<object>, string[]][] = [
  [
    'usuario',
    UpdateUserDto,
    ['name', 'email', 'password', 'phone', 'address', 'country', 'city'],
  ],
  [
    'producto',
    UpdateProductDto,
    ['name', 'description', 'price', 'stock', 'categoryId', 'imgUrl'],
  ],
  ['categoría', UpdateCategoryDto, ['name']],
  ['orden', UpdateOrderDto, ['userId', 'products']],
];

describe('Regresiones de validación de entradas', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  for (const [name, Dto, fields] of partialDtos) {
    it(`permite omitir campos de ${name}, pero rechaza null explícito`, async () => {
      expect(validateSync(plainToInstance(Dto, {}))).toHaveLength(0);
      for (const field of fields) {
        await expect(
          pipe.transform({ [field]: null }, { type: 'body', metatype: Dto }),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    });
  }

  it('acepta los límites de PostgreSQL y rechaza importes/teléfonos que desbordarían la columna', () => {
    expect(
      validateSync(
        plainToInstance(CreateProductDto, { ...product, price: 99999999.99 }),
      ),
    ).toHaveLength(0);
    expect(
      validateSync(
        plainToInstance(CreateProductDto, { ...product, price: 100000000 }),
      ),
    ).not.toHaveLength(0);
    expect(
      validateSync(
        plainToInstance(CreateUserDto, { ...user, phone: 2147483647 }),
      ),
    ).toHaveLength(0);
    expect(
      validateSync(
        plainToInstance(CreateUserDto, { ...user, phone: 2147483648 }),
      ),
    ).not.toHaveLength(0);
    expect(
      validateSync(
        plainToInstance(CreateUserDto, { ...user, phone: -2147483649 }),
      ),
    ).not.toHaveLength(0);
  });

  it('acepta precio y stock cero al actualizar', async () => {
    await expect(
      pipe.transform(
        { price: 0, stock: 0 },
        { type: 'body', metatype: UpdateProductDto },
      ),
    ).resolves.toMatchObject({ price: 0, stock: 0 });
  });

  it('permite crear sin imagen o con el campo vacío, pero rechaza una URL no válida', async () => {
    for (const image of [{}, { imgUrl: '' }, { imgUrl: '   ' }]) {
      const dto = await pipe.transform(
        { ...product, ...image },
        { type: 'body', metatype: CreateProductDto },
      );
      expect(dto.imgUrl).toBeUndefined();
    }
    await expect(
      pipe.transform(
        { ...product, imgUrl: 'string' },
        { type: 'body', metatype: CreateProductDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza arrays anidados como si fueran objetos de producto', () => {
    expect(
      validateSync(
        plainToInstance(CreateOrderDto, {
          userId: product.categoryId,
          products: [[]],
        }),
      ),
    ).not.toHaveLength(0);
  });

  it('acepta exactamente 200 KiB y rechaza un byte adicional', () => {
    const validator = new ImageSizeValidator({ maxSize: MAX_IMAGE_SIZE });
    expect(
      validator.isValid({ size: MAX_IMAGE_SIZE, mimetype: 'image/png' }),
    ).toBe(true);
    expect(
      validator.isValid({ size: MAX_IMAGE_SIZE + 1, mimetype: 'image/png' }),
    ).toBe(false);
  });
});
