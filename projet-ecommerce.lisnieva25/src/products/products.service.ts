import { Injectable } from '@nestjs/common';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { ProductsRepository } from './products.repository';

@Injectable()
export class ProductsService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  seedProducts() {
    return this.productsRepository.seedProducts();
  }

  resetProducts() {
    return this.productsRepository.resetProducts();
  }

  create(dto: CreateProductDto) {
    return this.productsRepository.create(dto);
  }

  findAll() {
    return this.productsRepository.findAll();
  }

  findOne(id: string) {
    return this.productsRepository.findOne(id);
  }

  update(id: string, dto: UpdateProductDto) {
    return this.productsRepository.update(id, dto);
  }

  remove(id: string) {
    return this.productsRepository.remove(id);
  }
}
