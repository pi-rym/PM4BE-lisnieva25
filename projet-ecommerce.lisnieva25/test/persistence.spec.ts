import { jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { DataSource, Repository } from 'typeorm';
import { ProductsRepository } from '../src/products/products.repository';
import { FilesRepository } from '../src/files/files.repository';
import { UsersRepository } from '../src/users/users.repository';
import { User } from '../src/users/entities/user.entity';
import { Product } from '../src/products/entities/product.entity';
import { Category } from '../src/categories/entities/category.entity';

describe('Actualizaciones parciales y errores de persistencia', () => {
  it('cambiar un nombre conserva el stock descontado después de leer el producto', async () => {
    const stored = {
      id: 'product',
      name: 'Anterior',
      price: '10.00',
      stock: 5,
    };
    const products = {
      findOneBy: async () => ({ ...stored }),
      exists: async () => {
        stored.stock -= 1;
        return false;
      },
      update: async (_id: string, fields: object) => {
        Object.assign(stored, fields);
        return { affected: 1 };
      },
      save: async (entity: object) => Object.assign(stored, entity),
    };
    const repository = new ProductsRepository(
      products as unknown as Repository<Product>,
      {} as Repository<Category>,
      {} as DataSource,
    );
    await repository.update(stored.id, { name: 'Nuevo' });
    expect(stored).toMatchObject({ name: 'Nuevo', stock: 4 });
  });

  it('actualizar la imagen no vuelve a guardar un stock antiguo', async () => {
    const stored = { id: 'product', imgUrl: 'anterior', stock: 3 };
    const oldSnapshot = { ...stored, stock: 5 } as Product;
    const products = {
      update: async (_id: string, fields: object) => {
        Object.assign(stored, fields);
        return { affected: 1 };
      },
      save: async (entity: object) => Object.assign(stored, entity),
    };
    const repository = new FilesRepository(
      products as unknown as Repository<Product>,
    );
    await repository.updateProductImage(oldSnapshot, 'nueva');
    expect(stored).toMatchObject({ imgUrl: 'nueva', stock: 3 });
  });

  it('devuelve conflicto al actualizar un correo duplicado', async () => {
    const error = new QueryFailedError(
      'UPDATE users',
      [],
      Object.assign(new Error('duplicate'), { code: '23505' }),
    );
    const users = {
      preload: async () => ({ id: 'user', email: 'ocupado@correo.com' }),
      save: jest.fn<Repository<User>['save']>().mockRejectedValue(error),
    };
    const repository = new UsersRepository(
      users as unknown as Repository<User>,
    );
    await expect(
      repository.update('user', { email: 'ocupado@correo.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
