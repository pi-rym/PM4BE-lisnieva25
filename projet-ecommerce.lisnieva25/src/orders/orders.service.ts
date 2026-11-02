import { ForbiddenException, Injectable } from '@nestjs/common';
import { CreateOrderDto, UpdateOrderDto } from './dto/order.dto';
import { OrdersRepository } from './orders.repository';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { Role } from '../auth/roles/roles';

@Injectable()
export class OrdersService {
  constructor(private readonly ordersRepository: OrdersRepository) {}

  create(createOrderDto: CreateOrderDto, actor: AuthenticatedUser) {
    if (
      actor.role !== Role.Admin &&
      actor.id.toLowerCase() !== createOrderDto.userId.toLowerCase()
    ) {
      throw new ForbiddenException('Solo puedes crear órdenes para tu cuenta');
    }
    return this.ordersRepository.addOrder(createOrderDto);
  }
  
  async findOne(id: string, actor: AuthenticatedUser) {
    const order = await this.ordersRepository.getOrder(id);
    if (actor.role !== Role.Admin && order.user?.id !== actor.id.toLowerCase()) {
      throw new ForbiddenException('Solo puedes consultar tus propias órdenes');
    }
    return order;
  }


  findAll() {
    return this.ordersRepository.getOrders();
  }

  update(id: string, dto: UpdateOrderDto) {
    return this.ordersRepository.updateOrder(id, dto);
  }

  remove(id: string) {
    return this.ordersRepository.removeOrder(id);
  }
}
