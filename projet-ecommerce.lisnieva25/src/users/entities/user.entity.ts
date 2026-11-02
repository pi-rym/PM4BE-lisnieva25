import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Order } from '../../orders/entities/order.entity';
import { ApiPropertyOptional } from '@nestjs/swagger';

@Entity('users')
export class User {
  @ApiProperty({
    format: 'uuid',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ maxLength: 50 })
  @Column({ type: 'varchar', length: 50 })
  name: string;

  @ApiProperty({ maxLength: 50 })
  @Column({ type: 'varchar', length: 50, unique: true })
  email: string;

  @ApiProperty({ writeOnly: true, maxLength: 255 })
  @Column({ type: 'varchar', length: 255, select: false })
  password: string;

  @ApiProperty({ example: 1122334455 })
  @Column({ type: 'int' })
  phone: number;

  @ApiProperty({ maxLength: 50 })
  @Column({ type: 'varchar', length: 50 })
  country: string;

  @ApiProperty()
  @Column({ type: 'text' })
  address: string;

  @ApiProperty({ maxLength: 50 })
  @Column({ type: 'varchar', length: 50 })
  city: string;

  @ApiProperty()
  @Column({ type: 'boolean', default: false })
  admin: boolean;

  @ApiPropertyOptional({ type: () => [Order] })
  @OneToMany(() => Order, (order) => order.user)
  orders: Relation<Order[]>;
}
