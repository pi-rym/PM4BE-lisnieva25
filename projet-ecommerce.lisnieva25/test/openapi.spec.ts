import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';
import { ProductsController } from '../src/products/products.controller';
import { ProductsService } from '../src/products/products.service';
import { OrdersController } from '../src/orders/orders.controller';
import { OrdersService } from '../src/orders/orders.service';
import { CategoriesController } from '../src/categories/categories.controller';
import { CategoriesService } from '../src/categories/categories.service';
import { FilesController } from '../src/files/files.controller';
import { FilesService } from '../src/files/files.service';
import { User } from '../src/users/entities/user.entity';
import { Product } from '../src/products/entities/product.entity';
import { Category } from '../src/categories/entities/category.entity';
import { Order, OrderDetail } from '../src/orders/entities/order.entity';

describe('OpenAPI', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      controllers: [
        AuthController,
        UsersController,
        ProductsController,
        OrdersController,
        CategoriesController,
        FilesController,
      ],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: ProductsService, useValue: {} },
        { provide: OrdersService, useValue: {} },
        { provide: CategoriesService, useValue: {} },
        { provide: FilesService, useValue: {} },
        { provide: JwtService, useValue: { verifyAsync: async () => ({}) } },
        { provide: Reflector, useValue: { getAllAndOverride: () => [] } },
        JwtAuthGuard,
        RolesGuard,
      ],
    }).compile();

    app = testingModule.createNestApplication();
    const config = new DocumentBuilder()
      .setTitle('Ecommerce API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config, {
      extraModels: [User, Product, Category, Order, OrderDetail],
    });
    SwaggerModule.setup('API', app, document, {
      jsonDocumentUrl: 'API-json',
      yamlDocumentUrl: 'API-yaml',
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('publica la especificación y las rutas de negocio', async () => {
    const response = await request(app.getHttpServer())
      .get('/API-json')
      .expect(200);
    const { paths, components } = response.body;

    expect(paths['/auth/signup'].post).toBeDefined();
    expect(paths['/auth/signin'].post).toBeDefined();
    expect(paths['/products'].get).toBeDefined();
    expect(paths['/products/{id}'].put).toBeDefined();
    expect(paths['/categories'].get).toBeDefined();
    expect(paths['/categories/seeder'].post).toBeDefined();
    expect(paths['/products/seeder'].post).toBeDefined();
    expect(paths['/products/seeder/reset'].post.responses['409']).toBeDefined();
    expect(paths['/orders'].post).toBeDefined();
    expect(paths['/orders/{id}'].get).toBeDefined();
    expect(paths['/users'].get).toBeDefined();
    expect(paths['/files/uploadImage/{productId}'].post).toBeDefined();

    expect(response.body.components.securitySchemes.bearer).toBeDefined();

    // Swagger debe reflejar qué rutas son públicas y cuáles exigen JWT.
    expect(paths['/auth/signup'].post.security).toBeUndefined();
    expect(paths['/auth/signin'].post.security).toBeUndefined();
    expect(paths['/orders'].post.security).toEqual([{ bearer: [] }]);
    expect(paths['/users'].get.security).toEqual([{ bearer: [] }]);
    expect(paths['/products/{id}'].put.security).toEqual([{ bearer: [] }]);
    for (const path of [
      '/categories/seeder',
      '/products/seeder',
      '/products/seeder/reset',
    ]) {
      expect(paths[path].post.security).toEqual([{ bearer: [] }]);
      expect(paths[path].post.responses['401']).toBeDefined();
      expect(paths[path].post.responses['403']).toBeDefined();
    }
    expect(
      components.schemas.CatalogSeedResultDto.properties.productsCreated,
    ).toBeDefined();

    // Los DTOs de entrada deben aparecer con sus campos documentados.
    expect(
      components.schemas.SignupUserDto.properties.confirmPassword,
    ).toBeDefined();
    expect(components.schemas.LoginUserDto.properties.password).toBeDefined();
    expect(components.schemas.CreateOrderDto.properties.products).toBeDefined();
    expect(
      components.schemas.CreateProductDto.properties.categoryId,
    ).toBeDefined();

    // Las entidades también se publican como esquemas reutilizables.
    expect(components.schemas.User.properties.id.format).toBe('uuid');
    expect(components.schemas.Product.properties.imgUrl).toBeDefined();
    expect(components.schemas.Product.properties.price.type).toBe('string');
    expect(components.schemas.Category.properties.name).toBeDefined();
    expect(components.schemas.Order.properties.date).toBeDefined();
    expect(components.schemas.OrderDetail.properties.price).toBeDefined();
    expect(components.schemas.OrderDetail.properties.price.type).toBe('string');

    expect(paths['/users/{id}'].get.responses['403']).toBeDefined();
    expect(paths['/orders/{id}'].get.responses['403']).toBeDefined();
    expect(paths['/orders'].post.responses['403']).toBeDefined();
    expect(paths['/products/{id}'].delete.responses['409']).toBeDefined();
    for (const operations of Object.values(paths) as Record<
      string,
      { summary?: string }
    >[]) {
      for (const operation of Object.values(operations)) {
        expect(operation.summary?.trim()).toBeTruthy();
      }
    }

    // Las respuestas detallan sus propiedades directamente en Swagger.
    const userProfileSchema =
      paths['/users/{id}'].get.responses['200'].content['application/json']
        .schema;
    const usersListSchema =
      paths['/users'].get.responses['200'].content['application/json'].schema;
    const orderSchema =
      paths['/orders/{id}'].get.responses['200'].content['application/json']
        .schema;
    const createdOrderSchema =
      paths['/orders'].post.responses['201'].content['application/json'].schema;
    const signUpSchema =
      paths['/auth/signup'].post.responses['201'].content['application/json']
        .schema;

    expect(userProfileSchema.properties.orders).toBeDefined();
    expect(usersListSchema.items.properties.admin).toBeDefined();
    expect(
      orderSchema.properties.orderDetail.properties.products,
    ).toBeDefined();
    expect(createdOrderSchema.properties.orderDetail).toBeDefined();
    expect(signUpSchema.properties.user.properties.password).toBeUndefined();
    expect(signUpSchema.properties.user.properties.id.format).toBe('uuid');
  });

  it('sirve la interfaz Swagger en /API', async () => {
    await request(app.getHttpServer())
      .get('/API')
      .expect(200)
      .expect('content-type', /html/);
  });
});
