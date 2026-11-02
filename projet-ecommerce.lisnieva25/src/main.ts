import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { User } from './users/entities/user.entity';
import { Product } from './products/entities/product.entity';
import { Category } from './categories/entities/category.entity';
import { Order, OrderDetail } from './orders/entities/order.entity';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const host = config.get<string>('app.host', 'localhost');
  const port = config.get<number>('app.port', 3000);

  // validaciones globales
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  
  const openApiConfig = new DocumentBuilder()
    .setTitle('Ecommerce API')
    .setDescription(
      'API de usuarios, productos, categorías, órdenes y archivos',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const openApiDocument = SwaggerModule.createDocument(app, openApiConfig, {
    extraModels: [User, Product, Category, Order, OrderDetail],
  });

  SwaggerModule.setup('API', app, openApiDocument, {
    jsonDocumentUrl: 'API-json',
    yamlDocumentUrl: 'API-yaml',
  });

  await app.listen(port, host);
  console.log(`Servidor escuchando en http://${host}:${port}/`);
}

bootstrap();
