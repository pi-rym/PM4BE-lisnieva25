import { Injectable } from '@nestjs/common';
import { CategoriesRepository } from './categories.repository';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { categoryExamples } from '../products/examples/products.examples';

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  getCategories() {
    return this.categoriesRepository.getCategories();
  }

  seedCategories() {
    return this.categoriesRepository.addCategories(categoryExamples);
  }

  getCategory(id: string) {
    return this.categoriesRepository.getCategory(id);
  }

  create(dto: CreateCategoryDto) {
    return this.categoriesRepository.create(dto);
  }

  update(id: string, dto: UpdateCategoryDto) {
    return this.categoriesRepository.update(id, dto);
  }

  remove(id: string) {
    return this.categoriesRepository.remove(id);
  }
}
