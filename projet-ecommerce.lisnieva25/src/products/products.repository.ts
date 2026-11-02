import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  In,
  MoreThan,
  QueryFailedError,
  Repository,
} from 'typeorm';
import type { EntityManager } from 'typeorm';
import { Category } from '../categories/entities/category.entity';
import { OrderDetail } from '../orders/entities/order.entity';
import {
  CreateProductDto,
  UpdateProductDto,
  CatalogSeedResultDto,
} from './dto/product.dto';
import { DEFAULT_PRODUCT_IMAGE, Product } from './entities/product.entity';
import {
  categoryExamples,
  productExamples,
} from './examples/products.examples';

@Injectable()
export class ProductsRepository {
  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    private readonly dataSource: DataSource,
  ) {}

  seedProducts(): Promise<CatalogSeedResultDto> {
    return this.dataSource.transaction((manager) =>
      this.insertExamples(manager),
    );
  }

  async resetProducts(): Promise<CatalogSeedResultDto> {
    try {
      return await this.dataSource.transaction(async (manager) => {

       // Impide que una compra enlace productos entre la comprobación y el borrado.
        // NOWAIT devuelve un conflicto si el catálogo ya se está modificando.
        const junction = this.dataSource
          .getMetadata(OrderDetail)
          .relations.find(
            (relation) => relation.propertyName === 'products',
          )!.junctionEntityMetadata!;
        const escape = (name: string) => this.dataSource.driver.escape(name);
        const tables = [
          this.dataSource.getMetadata(Category),
          this.dataSource.getMetadata(Product),
          junction,
        ].map((table) =>
          table.schema
            ? `${escape(table.schema)}.${escape(table.tableName)}`
            : escape(table.tableName),
        );
        await manager.query(
          `LOCK TABLE ${tables.join(', ')} IN EXCLUSIVE MODE NOWAIT`,
        );

        const hasPurchases = await manager
          .getRepository(OrderDetail)
          .createQueryBuilder('detail')
          .innerJoin('detail.products', 'product')
          .getExists();
        if (hasPurchases) {
          throw new ConflictException(
            'No se puede reiniciar el catálogo: hay productos asociados a órdenes de compra.',
          );
        }

        await manager.createQueryBuilder().delete().from(Product).execute();
        await manager.createQueryBuilder().delete().from(Category).execute();
        const result = await this.insertExamples(manager);
        return {
          ...result,
          message: 'Catálogo reiniciado con los datos de ejemplo.',
        };
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        ['55P03', '40P01'].includes(
          (error.driverError as { code: string }).code,
        )
      ) {
        throw new ConflictException(
          'El catálogo está siendo modificado. Intenta reiniciarlo nuevamente al finalizar la operación.',
        );
      }
      throw error;
    }
  }

  private async insertExamples(
    manager: EntityManager,
  ): Promise<CatalogSeedResultDto> {
    

    const categoryResult = await manager
      .createQueryBuilder()
      .insert()
      .into(Category)
      .values(categoryExamples.map((name) => ({ name })))
      .orIgnore()
      .returning('id')
      .execute();


    const categories = await manager
      .getRepository(Category)
      .createQueryBuilder('category')
      .where({ name: In(categoryExamples) })
      .orderBy('category.id', 'ASC')
      .setLock('pessimistic_read')
      .getMany();
    if (categories.length !== categoryExamples.length) {
      throw new ConflictException(
        'Las categorías cambiaron durante la precarga. Intenta nuevamente.',
      );
    }
    const byName = new Map(
      categories.map((category) => [category.name, category]),
    );
    const productResult = await manager
      .createQueryBuilder()
      .insert()
      .into(Product)
      .values(
        productExamples.map(({ category, price, ...product }) => ({
          ...product,
          price: price.toFixed(2),
          imgUrl: DEFAULT_PRODUCT_IMAGE,
          category: byName.get(category)!,
        })),
      )
      .orIgnore()
      .returning('id')
      .execute();

    return {
      message: 'Precarga completada; los registros existentes se conservaron.',
      categoriesCreated: categoryResult.raw.length,
      productsCreated: productResult.raw.length,
    };
  }

 
  findAll(): Promise<Product[]> {
    return this.products.find({
      where: { stock: MoreThan(0) },
      relations: { category: true },
      order: { name: 'ASC' },
    });
  }

  //obtiene un producto por id con su categoría
  async findOne(id: string): Promise<Product> {
    const product = await this.products.findOne({
      where: { id: id },
      relations: { category: true },
    });
    if (!product) throw new NotFoundException(`No existe el producto ${id}`);
    return product;
  }

 
  async create(dto: CreateProductDto): Promise<{ id: string }> {
    if (await this.products.exists({ where: { name: dto.name } })) {
      throw new ConflictException(`Ya existe un producto llamado ${dto.name}`);
    }

    
    const category = await this.categories.findOneBy({ id: dto.categoryId });
    if (!category) {
      throw new NotFoundException(`No existe la categoría ${dto.categoryId}`);
    }

   
    const product = this.products.create({
      name: dto.name,
      description: dto.description,
      price: dto.price.toFixed(2),
      stock: dto.stock,
      imgUrl: dto.imgUrl ?? DEFAULT_PRODUCT_IMAGE,
      category,
    });
    const savedProduct = await this.saveProduct(product);
    return { id: savedProduct.id };
  }

 
  async update(id: string, dto: UpdateProductDto): Promise<{ id: string }> {
    const product = await this.products.findOneBy({ id });
    if (!product) throw new NotFoundException(`No existe el producto ${id}`);

   
    if (
      dto.name &&
      dto.name !== product.name &&
      (await this.products.exists({ where: { name: dto.name } }))
    ) {
      throw new ConflictException(`Ya existe un producto llamado ${dto.name}`);
    }

   
    const changes: Parameters<Repository<Product>['update']>[1] = {};
    if (dto.name !== undefined) changes.name = dto.name;
    if (dto.description !== undefined) changes.description = dto.description;
    if (dto.price !== undefined) changes.price = dto.price.toFixed(2);
    if (dto.stock !== undefined) changes.stock = dto.stock;
    if (dto.imgUrl !== undefined) changes.imgUrl = dto.imgUrl;

    
    if (dto.categoryId !== undefined) {
      const category = await this.categories.findOneBy({ id: dto.categoryId });
      if (!category) {
        throw new NotFoundException(`No existe la categoría ${dto.categoryId}`);
      }
      changes.category = { id: category.id };
    }
    if (Object.keys(changes).length) {
      try {
        const result = await this.products.update(id, changes);
        if (!result.affected)
          throw new NotFoundException(`No existe el producto ${id}`);
      } catch (error) {
        this.handleWriteError(error, dto.name ?? product.name);
      }
    }
    return { id: product.id };
  }

  private async saveProduct(product: Product): Promise<Product> {
    try {
      return await this.products.save(product);
    } catch (error) {
      this.handleWriteError(error, product.name);
    }
  }

  private handleWriteError(error: unknown, name: string): never {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === '23505'
    ) {
      throw new ConflictException(`Ya existe un producto llamado ${name}`);
    }
    throw error;
  }

  
  async remove(id: string): Promise<{ id: string }> {
    await this.dataSource.transaction(async (manager) => {
      const products = manager.getRepository(Product);
      const product = await products.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) throw new NotFoundException(`No existe el producto ${id}`);

      const hasPurchases = await manager.getRepository(OrderDetail).exists({
        where: { products: { id } },
      });
      if (hasPurchases) {
        throw new ConflictException(
          'No se puede eliminar un producto asociado a órdenes de compra',
        );
      }
      await products.remove(product);
    });
    return { id };
  }
}
