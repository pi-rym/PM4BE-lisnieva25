import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Product } from '../../products/entities/product.entity';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';

@Entity('categories')
export class Category {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ maxLength: 50, example: 'smartphone' })
  @Column({ type: 'varchar', length: 50, unique: true })
  name: string;

  @ApiPropertyOptional({ type: () => [Product] })
  @OneToMany(() => Product, (product) => product.category)
  products: Relation<Product[]>;
}
