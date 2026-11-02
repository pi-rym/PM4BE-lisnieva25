import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesRepository {
  constructor(
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
  ) {}

  getCategories(): Promise<Category[]> {
    return this.categories.find({ order: { name: 'ASC' } });
  }

  async addCategories(names: string[]): Promise<Category[]> {
    const uniqueNames = [...new Set(names.map((name) => name.trim()))].filter(
      Boolean,
    );
    if (uniqueNames.length) {
      await this.categories
        .createQueryBuilder()
        .insert()
        .values(uniqueNames.map((name) => ({ name })))
        .orIgnore()
        .execute();
    }
    return this.getCategories();
  }

  async getCategory(id: string): Promise<Category> {
    const category = await this.categories.findOneBy({ id });
    if (!category) throw new NotFoundException(`No existe la categoría ${id}`);
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    if (await this.categories.exists({ where: { name: dto.name } })) {
      throw new ConflictException(`Ya existe la categoría ${dto.name}`);
    }
    return this.saveCategory(this.categories.create(dto));
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.getCategory(id);
    if (
      dto.name &&
      dto.name !== category.name &&
      (await this.categories.exists({ where: { name: dto.name } }))
    ) {
      throw new ConflictException(`Ya existe la categoría ${dto.name}`);
    }
    Object.assign(category, dto);
    return this.saveCategory(category);
  }

  async remove(id: string): Promise<{ id: string }> {
    const category = await this.getCategory(id);
    await this.categories.remove(category);
    return { id };
  }

  private async saveCategory(category: Category): Promise<Category> {
    try {
      return await this.categories.save(category);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        throw new ConflictException(`Ya existe la categoría ${category.name}`);
      }
      throw error;
    }
  }
}
