import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Category } from '../../categories/entities/category.entity';
import { OrderDetail } from '../../orders/entities/order.entity';
import { JoinColumn, ManyToMany, ManyToOne } from 'typeorm';

export const DEFAULT_PRODUCT_IMAGE =
  'https://res.cloudinary.com/demo/image/upload/sample.jpg';

@Index('UQ_products_name', ['name'], { unique: true })
@Entity('products')
export class Product {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ maxLength: 50 })
  @Column({ type: 'varchar', length: 50 })
  name: string;

  @ApiProperty()
  @Column({ type: 'text' })
  description: string;

  @ApiProperty({ example: '199.99', type: String })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: string;

  @ApiProperty({ example: 12, minimum: 0 })
  @Column({ type: 'int' })
  stock: number;

  @ApiProperty({ default: DEFAULT_PRODUCT_IMAGE })
  @Column({ type: 'text', default: DEFAULT_PRODUCT_IMAGE })
  imgUrl: string;

  @ApiProperty({ type: () => Category, required: false })
  @ManyToOne(() => Category, (category) => category.products, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'category_id' })
  category: Relation<Category | null>;

  @ApiPropertyOptional({ type: () => [OrderDetail] })
  @ManyToMany(() => OrderDetail, (detail) => detail.products)
  orderDetails: Relation<OrderDetail[]>;
}
