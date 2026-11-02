import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Product } from '../products/entities/product.entity';
import { Order, OrderDetail } from './entities/order.entity';
import { CreateOrderDto, UpdateOrderDto } from './dto/order.dto';

const MAX_DATABASE_INTEGER = 2147483647;
const MAX_MONEY_CENTS = 9999999999;
const MAX_MONEY_AMOUNT = MAX_MONEY_CENTS / 100;

@Injectable()
export class OrdersRepository {
  constructor(private readonly dataSource: DataSource) {}

  async addOrder(dto: CreateOrderDto) {
    const productIds = dto.products.map(({ id }) => id);
    if (new Set(productIds).size !== productIds.length) {
      // Verifica que no haya productos duplicados
      throw new BadRequestException(
        'Solo se permite una unidad de cada producto',
      );
    }

    // consulta y modifica  los registros dentro de la misma transaccion
    return this.dataSource.transaction(async (manager) => {
      const users = manager.getRepository(User);
      const products = manager.getRepository(Product);
      const orders = manager.getRepository(Order);
      const details = manager.getRepository(OrderDetail);

      const user = await users.findOneBy({ id: dto.userId });
      if (!user)
        throw new NotFoundException(`No existe el usuario ${dto.userId}`);

      const selectedProducts = await products.find({
        where: { id: In(productIds) },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (selectedProducts.length !== productIds.length) {
        throw new NotFoundException('Uno o más productos son inexistentes');
      }

      const outOfStock = selectedProducts.find((product) => product.stock <= 0); // Verifica si algún producto no tiene stock
      if (outOfStock) {
        throw new BadRequestException(
          `El producto ${outOfStock.name} no tiene stock`,
        );
      }

      const total = this.calculateTotal(selectedProducts);

      for (const product of selectedProducts) product.stock -= 1; // descuenta el stock de los productos seleccionados
      await products.save(selectedProducts);

      const order = await orders.save(
        orders.create({ user, date: new Date() }),
      );
      const detail = await details.save(
        details.create({
          order,
          products: selectedProducts,
          price: total,
        }),
      );

      return {
        id: order.id,
        date: order.date,
        userId: user.id,
        orderDetail: { id: detail.id, price: detail.price },
      };
    });
  }

  // busca una orden en especifico
  async getOrder(id: string) {
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { id },
      relations: { user: true, orderDetail: { products: true } },
    });
    if (!order) throw new NotFoundException(`No existe la orden ${id}`);

    return this.toResponse(order);
  }

  // obtiene todas las ordenes
  async getOrders() {
    const orders = await this.dataSource.getRepository(Order).find({
      relations: { user: true, orderDetail: { products: true } },
      order: { date: 'DESC' },
    });
    return orders.map((order) => this.toResponse(order));
  }

  // actualiza una orden
  async updateOrder(id: string, dto: UpdateOrderDto) {
    await this.dataSource.transaction(async (manager) => {
      const orders = manager.getRepository(Order);
      const users = manager.getRepository(User);
      const products = manager.getRepository(Product);
      const details = manager.getRepository(OrderDetail);
      const order = await orders.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException(`No existe la orden ${id}`);

      const currentDetail = await details.findOne({
        where: { order: { id } },
        relations: { products: true },
      });

      if (dto.userId) {
        const user = await users.findOneBy({ id: dto.userId });
        if (!user)
          throw new NotFoundException(`No existe el usuario ${dto.userId}`);
        order.user = user;
      }

      if (dto.products) {
        const productIds = dto.products.map(({ id: productId }) => productId);
        if (new Set(productIds).size !== productIds.length) {
          throw new BadRequestException(
            'Solo se permite una unidad de cada producto',
          );
        }

        const oldProducts = currentDetail?.products ?? [];
        const allIds = [
          ...new Set([
            ...oldProducts.map(({ id: productId }) => productId),
            ...productIds,
          ]),
        ];

        const lockedProducts = await products.find({
          where: { id: In(allIds) },
          order: { id: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });

        const productById = new Map(
          lockedProducts.map((product) => [product.id, product]),
        );

        const newProducts = productIds.map((productId) =>
          productById.get(productId),
        );

        if (newProducts.some((product) => !product)) {
          throw new NotFoundException('Uno o más productos no existen');
        }

        const oldIds = new Set(
          oldProducts.map(({ id: productId }) => productId),
        );
        const newIds = new Set(productIds);
        const outOfStock = newProducts.find(
          (product) => product && !oldIds.has(product.id) && product.stock <= 0,
        );
        if (outOfStock) {
          throw new BadRequestException(
            `El producto ${outOfStock.name} no tiene stock`,
          );
        }

        for (const product of lockedProducts) {
          if (oldIds.has(product.id) && !newIds.has(product.id)) {
            this.ensureCanRestoreStock(product);
            product.stock += 1;
          }
          if (!oldIds.has(product.id) && newIds.has(product.id))
            product.stock -= 1;
        }
        if (lockedProducts.length) await products.save(lockedProducts);

        const resolvedProducts = newProducts as Product[];
        const detail = currentDetail ?? details.create({ order, products: [] });
        detail.products = resolvedProducts;
        detail.price = this.calculateTotal(resolvedProducts);
        await details.save(detail);
      }

      await orders.save(order);
    });
    return this.getOrder(id);
  }

  // elimina una orden y reintegra su inventario
  async removeOrder(id: string): Promise<{ id: string }> {
    await this.dataSource.transaction(async (manager) => {
      const orders = manager.getRepository(Order);
      const products = manager.getRepository(Product);
      const order = await orders.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException(`No existe la orden ${id}`);

      const detail = await manager.getRepository(OrderDetail).findOne({
        where: { order: { id } },
        relations: { products: true },
      });
      const productIds = detail?.products.map((product) => product.id) ?? [];
      const orderedProducts = productIds.length
        ? await products.find({
            where: { id: In(productIds) },
            order: { id: 'ASC' },
            lock: { mode: 'pessimistic_write' },
          })
        : [];
      for (const product of orderedProducts) {
        this.ensureCanRestoreStock(product);
        product.stock += 1;
      }
      if (orderedProducts.length) await products.save(orderedProducts);
      await orders.remove(order);
    });
    return { id };
  }

  private toResponse(order: Order) {
    return {
      id: order.id,
      date: order.date,
      user: order.user ? { id: order.user.id } : null,
      orderDetail: order.orderDetail
        ? {
            id: order.orderDetail.id,
            price: order.orderDetail.price,
            products: order.orderDetail.products.map((product) => ({
              id: product.id,
              name: product.name,
              description: product.description,
              price: product.price,
              stock: product.stock,
              imgUrl: product.imgUrl,
            })),
          }
        : null,
    };
  }

  private calculateTotal(products: Product[]): string {
    const totalCents = products.reduce((total, product) => {
      const [wholePart, decimalPart = ''] = product.price.split('.');
      const cents =
        Number(wholePart) * 100 +
        Number(decimalPart.padEnd(2, '0').slice(0, 2));
      const nextTotal = total + cents;
      if (!Number.isSafeInteger(nextTotal) || nextTotal > MAX_MONEY_CENTS) {
        throw new BadRequestException(
          `El total de la orden no puede superar ${MAX_MONEY_AMOUNT}`,
        );
      }
      return nextTotal;
    }, 0);

    return (totalCents / 100).toFixed(2);
  }

  private ensureCanRestoreStock(product: Product): void {
    if (product.stock >= MAX_DATABASE_INTEGER) {
      throw new ConflictException(
        `No se puede reintegrar stock de ${product.name}: alcanzó el máximo permitido`,
      );
    }
  }
}
