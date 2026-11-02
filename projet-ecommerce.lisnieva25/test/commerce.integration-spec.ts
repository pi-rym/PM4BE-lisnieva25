import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { User } from '../src/users/entities/user.entity';
import {
  DEFAULT_PRODUCT_IMAGE,
  Product,
} from '../src/products/entities/product.entity';
import { Category } from '../src/categories/entities/category.entity';
import { Order, OrderDetail } from '../src/orders/entities/order.entity';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';
import { UsersRepository } from '../src/users/users.repository';
import { ProductsController } from '../src/products/products.controller';
import { ProductsService } from '../src/products/products.service';
import { ProductsRepository } from '../src/products/products.repository';
import { CategoriesController } from '../src/categories/categories.controller';
import { CategoriesService } from '../src/categories/categories.service';
import { CategoriesRepository } from '../src/categories/categories.repository';
import { OrdersController } from '../src/orders/orders.controller';
import { OrdersService } from '../src/orders/orders.service';
import { OrdersRepository } from '../src/orders/orders.repository';
import { FilesController } from '../src/files/files.controller';
import { FilesService } from '../src/files/files.service';
import { FilesRepository } from '../src/files/files.repository';
import { CLOUDINARY_CLIENT } from '../src/config/cloudinary.config';
import { MAX_IMAGE_SIZE } from '../src/files/validators/image-size.validator';
import { productExamples } from '../src/products/examples/products.examples';

// Solo se selecciona explícitamente con test:integration. Cada ejecución usa un schema nuevo.
const fileEnvironment: Record<string, string> = {};
for (const file of ['.env', '.env.development']) {
  if (existsSync(file))
    Object.assign(fileEnvironment, parseEnv(readFileSync(file, 'utf8')));
}
const environment = { ...fileEnvironment, ...process.env };
const schema = `logic_test_${randomBytes(8).toString('hex')}`;
const entities = [User, Product, Category, Order, OrderDetail];
const source = new DataSource({
  type: 'postgres',
  host: environment.DB_HOST,
  port: Number(environment.DB_PORT ?? 5432),
  username: environment.DB_USERNAME,
  password: environment.DB_PASSWORD,
  database: environment.DB_DATABASE?.trim() || environment.DB_NAME?.trim(),
  schema,
  entities,
  // gen_random_uuid no depende de funciones del schema public.
  uuidExtension: 'pgcrypto',
  synchronize: true,
  dropSchema: false,
  // Sin public en el search_path: el SQL sin calificar no puede modificar tablas de la aplicación.
  extra: { options: `-c search_path=${schema}`, connectionTimeoutMillis: 5000 },
});

describe('Comercio: HTTP, sincronización y PostgreSQL real en schema aislado', () => {
  let app: INestApplication;
  let user: User;
  let admin: User;
  let products: Product[];
  let token: string;
  let adminToken: string;
  let orders: OrdersRepository;
  let initialProductCount: number;
  let initialCategoryCount: number;
  let createdSchema = false;
  const password = 'Clave123!';
  const cloudinary = {
    uploader: {
      upload_stream: (options: { public_id: string }, callback: Function) => ({
        end: () =>
          callback(undefined, {
            public_id: options.public_id,
            secure_url: `https://images.example/${options.public_id}.png`,
          }),
      }),
      destroy: async () => ({ result: 'ok' }),
    },
  };

  beforeAll(async () => {
    for (const key of ['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD']) {
      if (!environment[key])
        throw new Error(
          `Falta configurar ${key} para las pruebas de integración`,
        );
    }
    // Crea el schema antes de que initialize sincronice las entidades.
    const setup = new DataSource({
      ...source.options,
      entities: [],
      synchronize: false,
    });
    await setup.initialize();
    try {
      await setup.query(`CREATE SCHEMA "${schema}"`);
      createdSchema = true;
      await source.initialize();
    } catch (error) {
      if (createdSchema) {
        await setup.query(`DROP SCHEMA "${schema}" CASCADE`);
        createdSchema = false;
      }
      throw error;
    } finally {
      await setup.destroy();
    }
    const module = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: randomBytes(32).toString('hex'),
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [
        AuthController,
        UsersController,
        ProductsController,
        CategoriesController,
        OrdersController,
        FilesController,
      ],
      providers: [
        AuthService,
        UsersService,
        ProductsService,
        CategoriesService,
        OrdersService,
        FilesService,
        UsersRepository,
        ProductsRepository,
        CategoriesRepository,
        OrdersRepository,
        FilesRepository,
        JwtAuthGuard,
        RolesGuard,
        { provide: DataSource, useValue: source },
        { provide: CLOUDINARY_CLIENT, useValue: cloudinary },
        ...entities.map((entity) => ({
          provide: getRepositoryToken(entity),
          useValue: source.getRepository(entity),
        })),
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    orders = app.get(OrdersRepository);
    initialProductCount = await source.getRepository(Product).count();
    initialCategoryCount = await source.getRepository(Category).count();
  }, 30000);

  beforeEach(async () => {
    if (!source.isInitialized || !createdSchema) return;
    await source.query(
      `TRUNCATE TABLE "${schema}"."order_details_products", "${schema}"."order_details", "${schema}"."orders", "${schema}"."products", "${schema}"."categories", "${schema}"."users" CASCADE`,
    );
    const users = source.getRepository(User);
    const data = {
      name: 'Ana Perez',
      password: await bcrypt.hash(password, 4),
      phone: 1122334455,
      country: 'Argentina',
      address: 'Calle 123',
      city: 'Buenos Aires',
    };
    user = await users.save(
      users.create({ ...data, email: 'ana@correo.com', admin: false }),
    );
    admin = await users.save(
      users.create({ ...data, email: 'admin@correo.com', admin: true }),
    );
    const category = await source
      .getRepository(Category)
      .save({ name: 'Ejemplo' });
    products = await source.getRepository(Product).save(
      [10, 20, 30].map((price, index) => ({
        name: `Producto ${index}`,
        description: 'Descripción',
        price: price.toFixed(2),
        stock: 3,
        category,
      })),
    );
    const jwt = app.get(JwtService);
    token = await jwt.signAsync({ sub: user.id });
    adminToken = await jwt.signAsync({ sub: admin.id, role: 'admin' });
  });

  afterAll(async () => {
    try {
      if (app) await app.close();
    } finally {
      if (source.isInitialized) {
        try {
          if (createdSchema && /^logic_test_[a-f0-9]{16}$/.test(schema)) {
            await source.query(`DROP SCHEMA "${schema}" CASCADE`);
          }
        } finally {
          await source.destroy();
        }
      }
    }
  });

  it('sincroniza las entidades con precio (10,2) y claves foráneas en el schema de prueba', async () => {
    const columns = await source.query(
      'SELECT numeric_precision, numeric_scale FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3',
      [schema, 'order_details', 'price'],
    );
    expect(columns[0]).toMatchObject({
      numeric_precision: 10,
      numeric_scale: 2,
    });
    const keys = await source.query(
      'SELECT count(*)::int AS count FROM pg_constraint WHERE connamespace = $1::regnamespace AND contype = $2',
      [schema, 'f'],
    );
    expect(keys[0].count).toBe(5);
  });

  it('inicializa la aplicación sin insertar categorías ni productos automáticamente', () => {
    expect(initialCategoryCount).toBe(0);
    expect(initialProductCount).toBe(0);
  });

  it('registra con hash, omite datos sensibles y permite iniciar sesión con JWT de una hora', async () => {
    const body = {
      name: 'Otra Persona',
      email: 'otra@correo.com',
      password,
      confirmPassword: password,
      phone: 123456789,
      address: 'Calle 456',
      country: 'Argentina',
      city: 'Buenos Aires',
    };
    const signup = await request(app.getHttpServer())
      .post('/auth/signup')
      .send(body)
      .expect(201);
    expect(signup.body.user.password).toBeUndefined();
    expect(signup.body.user.admin).toBeUndefined();
    const stored = await source.getRepository(User).findOne({
      where: { email: body.email },
      select: { password: true, admin: true },
    });
    expect(await bcrypt.compare(password, stored!.password)).toBe(true);
    expect(stored!.admin).toBe(false);
    const signin = await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email: body.email, password })
      .expect(201);
    const payload = await app
      .get(JwtService)
      .verifyAsync(signin.body.accessToken);
    expect(payload.exp - payload.iat).toBe(3600);
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ ...body, admin: true })
      .expect(400);
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ ...body, confirmPassword: 'Diferente1!' })
      .expect(400);
    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email: body.email, password: 'Incorrecta1!' })
      .expect(401);
    const unknownUser = await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email: 'ausente@correo.com', password })
      .expect(401);
    expect(wrongPassword.body.message).toBe(unknownUser.body.message);
  });

  it('crea una compra con detalle, descuenta stock y devuelve órdenes reducidas en el perfil', async () => {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .auth(token, { type: 'bearer' })
      .send({
        userId: user.id,
        products: products.slice(0, 2).map(({ id }) => ({ id })),
      })
      .expect(201);
    expect(response.body.orderDetail.price).toBe('30.00');
    const order = await request(app.getHttpServer())
      .get(`/orders/${response.body.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(order.body.orderDetail.products).toHaveLength(2);
    expect(
      (
        await source
          .getRepository(Product)
          .findOneByOrFail({ id: products[0].id })
      ).stock,
    ).toBe(2);
    const profile = await request(app.getHttpServer())
      .get(`/users/${user.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(Object.keys(profile.body.orders[0]).sort()).toEqual(['date', 'id']);
    expect(profile.body.admin).toBeUndefined();
    expect(profile.body.password).toBeUndefined();
  });

  it('rechaza duplicados y falta de stock sin dejar una compra parcial', async () => {
    await request(app.getHttpServer())
      .post('/orders')
      .auth(token, { type: 'bearer' })
      .send({
        userId: user.id,
        products: [{ id: products[0].id }, { id: products[0].id }],
      })
      .expect(400);
    await source.getRepository(Product).update(products[1].id, { stock: 0 });
    await request(app.getHttpServer())
      .post('/orders')
      .auth(token, { type: 'bearer' })
      .send({
        userId: user.id,
        products: products.slice(0, 2).map(({ id }) => ({ id })),
      })
      .expect(400);
    expect(await source.getRepository(Order).count()).toBe(0);
    expect(await source.getRepository(OrderDetail).count()).toBe(0);
    expect(
      (
        await source
          .getRepository(Product)
          .findOneByOrFail({ id: products[0].id })
      ).stock,
    ).toBe(3);
    const list = await request(app.getHttpServer())
      .get('/products')
      .expect(200);
    expect(
      list.body.some((product: Product) => product.id === products[1].id),
    ).toBe(false);
  });

  it('rechaza un total que excedería numeric(10,2) sin descontar stock', async () => {
    await source
      .getRepository(Product)
      .update(products[0].id, { price: '60000000.00' });
    await source
      .getRepository(Product)
      .update(products[1].id, { price: '60000000.00' });
    await request(app.getHttpServer())
      .post('/orders')
      .auth(token, { type: 'bearer' })
      .send({
        userId: user.id,
        products: products.slice(0, 2).map(({ id }) => ({ id })),
      })
      .expect(400);
    expect(await source.getRepository(Order).count()).toBe(0);
    expect(
      (
        await source
          .getRepository(Product)
          .findOneByOrFail({ id: products[0].id })
      ).stock,
    ).toBe(3);
  });

  it('ajusta únicamente las diferencias de inventario al editar una orden', async () => {
    const created = await orders.addOrder({
      userId: user.id,
      products: products.slice(0, 2).map(({ id }) => ({ id })),
    });
    await request(app.getHttpServer())
      .put(`/orders/${created.id}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ products: products.slice(1).map(({ id }) => ({ id })) })
      .expect(200);
    const stored = await Promise.all(
      products.map((product) =>
        source.getRepository(Product).findOneByOrFail({ id: product.id }),
      ),
    );
    expect(stored.map((product) => product.stock)).toEqual([3, 2, 2]);
    expect((await orders.getOrder(created.id)).orderDetail?.price).toBe(
      '50.00',
    );
  });

  it('dos eliminaciones concurrentes reintegran ambas unidades sin perder stock', async () => {
    const dto = { userId: user.id, products: [{ id: products[0].id }] };
    const first = await orders.addOrder(dto);
    const second = await orders.addOrder(dto);
    await source.query(
      `CREATE FUNCTION "${schema}".delay_stock_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.1); RETURN NEW; END $$`,
    );
    await source.query(
      `CREATE TRIGGER delay_stock_update BEFORE UPDATE OF stock ON "${schema}".products FOR EACH ROW EXECUTE FUNCTION "${schema}".delay_stock_update()`,
    );
    try {
      await Promise.all([
        orders.removeOrder(first.id),
        orders.removeOrder(second.id),
      ]);
      expect(
        (
          await source
            .getRepository(Product)
            .findOneByOrFail({ id: products[0].id })
        ).stock,
      ).toBe(3);
      expect(await source.getRepository(OrderDetail).count()).toBe(0);
    } finally {
      await source.query(
        `DROP TRIGGER delay_stock_update ON "${schema}".products`,
      );
      await source.query(`DROP FUNCTION "${schema}".delay_stock_update()`);
    }
  });

  it('dos compras simultáneas no pueden vender la misma última unidad', async () => {
    await source.getRepository(Product).update(products[0].id, { stock: 1 });
    const body = { userId: user.id, products: [{ id: products[0].id }] };
    const responses = await Promise.all(
      [0, 1].map(() =>
        request(app.getHttpServer())
          .post('/orders')
          .auth(token, { type: 'bearer' })
          .send(body),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 400,
    ]);
    expect(await source.getRepository(Order).count()).toBe(1);
    expect(
      (
        await source
          .getRepository(Product)
          .findOneByOrFail({ id: products[0].id })
      ).stock,
    ).toBe(0);
  });

  it('rechaza el reintegro que desbordaría stock y conserva la orden', async () => {
    const order = await orders.addOrder({
      userId: user.id,
      products: [{ id: products[0].id }],
    });
    await source
      .getRepository(Product)
      .update(products[0].id, { stock: 2147483647 });
    await request(app.getHttpServer())
      .delete(`/orders/${order.id}`)
      .auth(adminToken, { type: 'bearer' })
      .expect(409);
    expect(await source.getRepository(Order).count()).toBe(1);
    expect(
      (
        await source
          .getRepository(Product)
          .findOneByOrFail({ id: products[0].id })
      ).stock,
    ).toBe(2147483647);
  });

  it('repite la sincronización sin perder usuarios, productos ni compras', async () => {
    const order = await orders.addOrder({
      userId: user.id,
      products: [{ id: products[0].id }],
    });
    const before = await orders.getOrder(order.id);
    await source.synchronize();
    expect(await orders.getOrder(order.id)).toEqual(before);
    expect(await source.getRepository(User).count()).toBe(2);
    expect(await source.getRepository(Product).count()).toBe(3);
    expect(await source.getRepository(Category).count()).toBe(1);
  });

  it('crea productos sin imagen y conserva la imagen existente al actualizar con un campo vacío', async () => {
    const category = await source
      .getRepository(Category)
      .findOneByOrFail({ name: 'Ejemplo' });
    const body = {
      description: 'Producto sin imagen propia',
      price: 12.5,
      stock: 1,
      categoryId: category.id,
    };
    const cases = [{}, { imgUrl: '' }, { imgUrl: '   ' }];
    for (const [index, image] of cases.entries()) {
      const response = await request(app.getHttpServer())
        .post('/products')
        .auth(adminToken, { type: 'bearer' })
        .send({ ...body, name: `Sin imagen ${index}`, ...image })
        .expect(201);
      const saved = await source
        .getRepository(Product)
        .findOneByOrFail({ id: response.body.id });
      expect(saved.imgUrl).toBe(DEFAULT_PRODUCT_IMAGE);
    }
    const imgUrl = 'https://example.com/producto.png';
    const response = await request(app.getHttpServer())
      .post('/products')
      .auth(adminToken, { type: 'bearer' })
      .send({ ...body, name: 'Con imagen', imgUrl })
      .expect(201);
    await request(app.getHttpServer())
      .put(`/products/${response.body.id}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ imgUrl: '' })
      .expect(200);
    expect(
      (
        await source
          .getRepository(Product)
          .findOneByOrFail({ id: response.body.id })
      ).imgUrl,
    ).toBe(imgUrl);
    await request(app.getHttpServer())
      .post('/products')
      .auth(adminToken, { type: 'bearer' })
      .send({ ...body, name: 'URL incorrecta', imgUrl: 'string' })
      .expect(400);
  });

  it('actualiza un correo duplicado con 409 y rechaza null/precios fuera de rango con 400', async () => {
    await request(app.getHttpServer())
      .put(`/users/${user.id}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ email: admin.email })
      .expect(409);
    await request(app.getHttpServer())
      .put(`/products/${products[0].id}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ price: null })
      .expect(400);
    await request(app.getHttpServer())
      .put(`/products/${products[0].id}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ price: 100000000 })
      .expect(400);
    await request(app.getHttpServer())
      .put(`/products/${products[0].id}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ price: 0, stock: 0 })
      .expect(200);
    expect(
      await source
        .getRepository(Product)
        .findOneByOrFail({ id: products[0].id }),
    ).toMatchObject({ price: '0.00', stock: 0 });
  });

  it('acepta imágenes de exactamente 200 KiB y guarda la URL; rechaza exceso y contenido falso', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLp8AAAAASUVORK5CYII=',
      'base64',
    );
    const image = Buffer.concat([
      png,
      Buffer.alloc(MAX_IMAGE_SIZE - png.length),
    ]);
    const response = await request(app.getHttpServer())
      .post(`/files/uploadImage/${products[0].id}`)
      .auth(adminToken, { type: 'bearer' })
      .attach('file', image, {
        filename: 'image.png',
        contentType: 'image/png',
      })
      .expect(201);
    expect(
      (
        await source
          .getRepository(Product)
          .findOneByOrFail({ id: products[0].id })
      ).imgUrl,
    ).toBe(response.body.imgUrl);
    await request(app.getHttpServer())
      .post(`/files/uploadImage/${products[0].id}`)
      .auth(adminToken, { type: 'bearer' })
      .attach('file', Buffer.concat([image, Buffer.from([0])]), {
        filename: 'large.png',
        contentType: 'image/png',
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/files/uploadImage/${products[0].id}`)
      .auth(adminToken, { type: 'bearer' })
      .attach('file', Buffer.from('esto no es una imagen'), {
        filename: 'false.png',
        contentType: 'image/png',
      })
      .expect(400);
  });

  it('permite crear los productos de ejemplo mediante el CRUD y rechaza nombres duplicados', async () => {
    const categories = new Map<string, string>();
    for (const name of new Set(
      productExamples.map((product) => product.category),
    )) {
      const response = await request(app.getHttpServer())
        .post('/categories')
        .auth(adminToken, { type: 'bearer' })
        .send({ name })
        .expect(201);
      categories.set(name, response.body.id);
    }
    for (const { category, ...product } of productExamples) {
      await request(app.getHttpServer())
        .post('/products')
        .auth(adminToken, { type: 'bearer' })
        .send({ ...product, categoryId: categories.get(category) })
        .expect(201);
    }
    const { category, ...product } = productExamples[0];
    await request(app.getHttpServer())
      .post('/categories')
      .auth(adminToken, { type: 'bearer' })
      .send({ name: category })
      .expect(409);
    await request(app.getHttpServer())
      .post('/products')
      .auth(adminToken, { type: 'bearer' })
      .send({ ...product, categoryId: categories.get(category) })
      .expect(409);
    expect(await source.getRepository(Category).count()).toBe(5);
    expect(await source.getRepository(Product).count()).toBe(15);
  });

  it('precarga por peticiones y repite los seeders sin duplicar datos ni reponer productos comprados', async () => {
    await request(app.getHttpServer())
      .post('/categories/seeder')
      .auth(adminToken, { type: 'bearer' })
      .expect(201);
    const seeded = await request(app.getHttpServer())
      .post('/products/seeder')
      .auth(adminToken, { type: 'bearer' })
      .expect(201);
    expect(seeded.body).toMatchObject({
      categoriesCreated: 0,
      productsCreated: 12,
    });
    for (let repeat = 0; repeat < 2; repeat++) {
      const categories = await request(app.getHttpServer())
        .post('/categories/seeder')
        .auth(adminToken, { type: 'bearer' })
        .expect(201);
      expect(categories.body).toHaveLength(5);
    }
    const repository = source.getRepository(Product);
    const example = await repository.findOneByOrFail({
      name: productExamples[0].name,
    });
    await repository.update(example.id, {
      imgUrl: 'https://images.example/custom.png',
      price: '123.45',
    });
    const order = await orders.addOrder({
      userId: user.id,
      products: [{ id: example.id }],
    });
    const before = await repository.find({ order: { id: 'ASC' } });

    const repeated = await request(app.getHttpServer())
      .post('/products/seeder')
      .auth(adminToken, { type: 'bearer' })
      .expect(201);
    expect(repeated.body).toMatchObject({
      categoriesCreated: 0,
      productsCreated: 0,
    });
    expect(await source.getRepository(Category).count()).toBe(5);
    expect(await repository.find({ order: { id: 'ASC' } })).toEqual(before);
    expect((await repository.findOneByOrFail({ id: example.id })).stock).toBe(
      11,
    );
    expect((await orders.getOrder(order.id)).orderDetail.products[0].id).toBe(
      example.id,
    );
  });

  it('reinicia el catálogo sin compras y conserva las cuentas de usuario', async () => {
    const response = await request(app.getHttpServer())
      .post('/products/seeder/reset')
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(response.body).toMatchObject({
      categoriesCreated: 4,
      productsCreated: 12,
    });
    const catalog = await source
      .getRepository(Product)
      .find({ relations: { category: true } });
    expect(catalog).toHaveLength(12);
    expect(await source.getRepository(Category).count()).toBe(4);
    expect(await source.getRepository(User).count()).toBe(2);
    expect(await source.getRepository(Order).count()).toBe(0);
    expect(
      catalog.some(({ id }) => products.some((old) => old.id === id)),
    ).toBe(false);
    for (const example of productExamples) {
      expect(catalog.find(({ name }) => name === example.name)).toMatchObject({
        stock: example.stock,
        price: example.price.toFixed(2),
        imgUrl: DEFAULT_PRODUCT_IMAGE,
        category: { name: example.category },
      });
    }
  });

  it('bloquea el reinicio si un producto forma parte de una compra y conserva todos los datos', async () => {
    await app.get(ProductsService).seedProducts();
    const repository = source.getRepository(Product);
    const example = await repository.findOneByOrFail({
      name: productExamples[0].name,
    });
    const order = await orders.addOrder({
      userId: user.id,
      products: [{ id: example.id }],
    });
    const before = await repository.find({ order: { id: 'ASC' } });
    const categoriesBefore = await source
      .getRepository(Category)
      .find({ order: { id: 'ASC' } });
    const response = await request(app.getHttpServer())
      .post('/products/seeder/reset')
      .auth(adminToken, { type: 'bearer' })
      .expect(409);
    expect(response.body.message).toContain('órdenes de compra');
    expect(await repository.find({ order: { id: 'ASC' } })).toEqual(before);
    expect(
      await source.getRepository(Category).find({ order: { id: 'ASC' } }),
    ).toEqual(categoriesBefore);
    expect((await orders.getOrder(order.id)).orderDetail.products[0].id).toBe(
      example.id,
    );
  });

  it('rechaza el reinicio mientras otra transacción modifica el catálogo', async () => {
    const runner = source.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.manager.getRepository(Product).findOneOrFail({
        where: { id: products[0].id },
        lock: { mode: 'pessimistic_write' },
      });
      const response = await request(app.getHttpServer())
        .post('/products/seeder/reset')
        .auth(adminToken, { type: 'bearer' })
        .timeout({ response: 2000 })
        .expect(409);
      expect(response.body.message).toContain('está siendo modificado');
      expect(await source.getRepository(Product).count()).toBe(3);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it('protege los seeders y el reinicio con JWT y rol de administrador', async () => {
    for (const path of [
      '/categories/seeder',
      '/products/seeder',
      '/products/seeder/reset',
    ]) {
      await request(app.getHttpServer()).post(path).expect(401);
      await request(app.getHttpServer())
        .post(path)
        .auth(token, { type: 'bearer' })
        .expect(403);
    }
    expect(await source.getRepository(Product).count()).toBe(3);
    expect(await source.getRepository(Category).count()).toBe(1);
  });

  it('limita los perfiles al titular y permite la consulta administrativa', async () => {
    await request(app.getHttpServer())
      .get(`/users/${admin.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403);
    const ownProfile = await request(app.getHttpServer())
      .get(`/users/${user.id.toUpperCase()}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(ownProfile.body.id).toBe(user.id);
    const adminView = await request(app.getHttpServer())
      .get(`/users/${user.id}`)
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(adminView.body.id).toBe(user.id);
  });

  it('impide crear y consultar órdenes ajenas, manteniendo el acceso del titular y del administrador', async () => {
    await request(app.getHttpServer())
      .post('/orders')
      .auth(token, { type: 'bearer' })
      .send({ userId: admin.id, products: [{ id: products[0].id }] })
      .expect(403);
    expect(await source.getRepository(Order).count()).toBe(0);
    const unchanged = await source.getRepository(Product).findOneByOrFail({
      id: products[0].id,
    });
    expect(unchanged.stock).toBe(3);

    const foreignOrder = await orders.addOrder({
      userId: admin.id,
      products: [{ id: products[0].id }],
    });
    await request(app.getHttpServer())
      .get(`/orders/${foreignOrder.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .get(`/orders/${foreignOrder.id}`)
      .auth(adminToken, { type: 'bearer' })
      .expect(200);

    const created = await request(app.getHttpServer())
      .post('/orders')
      .auth(adminToken, { type: 'bearer' })
      .send({ userId: user.id, products: [{ id: products[1].id }] })
      .expect(201);
    for (const accessToken of [token, adminToken]) {
      await request(app.getHttpServer())
        .get(`/orders/${created.body.id}`)
        .auth(accessToken, { type: 'bearer' })
        .expect(200);
    }
    await request(app.getHttpServer())
      .post('/orders')
      .auth(token, { type: 'bearer' })
      .send({
        userId: user.id.toUpperCase(),
        products: [{ id: products[2].id }],
      })
      .expect(201);
  });

  it('reserva al administrador la consulta de una orden cuyo usuario fue eliminado', async () => {
    const order = await orders.addOrder({
      userId: user.id,
      products: [{ id: products[0].id }],
    });
    await source.getRepository(User).delete(user.id);
    await request(app.getHttpServer())
      .get(`/orders/${order.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403);
    const response = await request(app.getHttpServer())
      .get(`/orders/${order.id}`)
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(response.body.user).toBeNull();
  });

  it('rechaza borrar un producto comprado y conserva el detalle, el total y el stock', async () => {
    const order = await orders.addOrder({
      userId: user.id,
      products: [{ id: products[0].id }],
    });
    const before = await orders.getOrder(order.id);
    await request(app.getHttpServer())
      .delete(`/products/${products[0].id}`)
      .auth(adminToken, { type: 'bearer' })
      .expect(409);
    expect(await orders.getOrder(order.id)).toEqual(before);
    const preserved = await source.getRepository(Product).findOneByOrFail({
      id: products[0].id,
    });
    expect(preserved.stock).toBe(2);
  });

  it('permite eliminar un producto sin compras y devuelve 404 al repetir el borrado', async () => {
    await request(app.getHttpServer())
      .delete(`/products/${products[0].id}`)
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(
      await source.getRepository(Product).findOneBy({ id: products[0].id }),
    ).toBeNull();
    await request(app.getHttpServer())
      .delete(`/products/${products[0].id}`)
      .auth(adminToken, { type: 'bearer' })
      .expect(404);
  });

  it('serializa una compra y un borrado simultáneos sin perder productos del historial', async () => {
    for (const product of products) {
      const [purchase, deletion] = await Promise.all([
        request(app.getHttpServer())
          .post('/orders')
          .auth(token, { type: 'bearer' })
          .send({ userId: user.id, products: [{ id: product.id }] }),
        request(app.getHttpServer())
          .delete(`/products/${product.id}`)
          .auth(adminToken, { type: 'bearer' }),
      ]);
      if (purchase.status === 201) {
        expect(deletion.status).toBe(409);
        const stored = await orders.getOrder(purchase.body.id);
        expect(stored.orderDetail?.products.map(({ id }) => id)).toEqual([
          product.id,
        ]);
        expect(stored.orderDetail?.price).toBe(product.price);
      } else {
        expect(purchase.status).toBe(404);
        expect(deletion.status).toBe(200);
        expect(
          await source.getRepository(Product).findOneBy({ id: product.id }),
        ).toBeNull();
      }
    }
  });

  it('mantiene la autenticación, los roles y la validación UUID', async () => {
    await request(app.getHttpServer())
      .get(`/orders/${products[0].id}`)
      .expect(401);
    await request(app.getHttpServer())
      .get('/users')
      .auth(token, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .get('/orders/no-es-uuid')
      .auth(token, { type: 'bearer' })
      .expect(400);
    const response = await request(app.getHttpServer())
      .get('/users')
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(response.body.find((row: User) => row.id === admin.id).admin).toBe(
      true,
    );
  });
});
