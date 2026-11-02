import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class FilesRepository {
  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
  ) {}

  async getProductById(id: string): Promise<Product> {
    const product = await this.products.findOneBy({ id });
    if (!product) throw new NotFoundException(`No existe el producto ${id}`);
    return product;
  }

  async updateProductImage(product: Product, imgUrl: string): Promise<Product> {
    const result = await this.products.update(product.id, { imgUrl });
    if (!result.affected) {
      throw new NotFoundException(`No existe el producto ${product.id}`);
    }
    product.imgUrl = imgUrl;
    return product;
  }
}
