# Ecommerce API

API REST construida con NestJS, TypeORM y PostgreSQL. Gestiona autenticación, usuarios, productos, categorías, órdenes e imágenes en Cloudinary.

## Inicio

Desde esta carpeta del proyecto:

```bash
npm install
```

`.env` configura `HOST`, `PORT`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET`. 

Crea la base de datos y ejecuta:

```bash
npm run start:dev
```

El proyecto usa `synchronize: true`: al iniciar, TypeORM crea y ajusta las tablas, columnas, índices y relaciones a partir de las entidades. La base de datos debe existir previamente. No se utilizan archivos ni comandos de migraciones. La sincronización puede modificar la estructura y afectar datos existentes cuando cambian las entidades.

## Documentación interactiva

Con la aplicación en ejecución, abre `http://localhost:3000/API`. Swagger muestra rutas, parámetros, DTOs, entidades y esquemas de respuesta. Para rutas protegidas, usa **Authorize** y escribe `Bearer <accessToken>`.

La URL base usa el host y puerto definidos en `.env` (`localhost:3000` por defecto). Los cuerpos JSON deben enviarse con `Content-Type: application/json`, excepto la carga de imágenes, que usa `multipart/form-data` con el campo `file`.

## Acceso y rutas

`Público` no requiere token. `Usuario` requiere JWT válido. `Administrador` requiere JWT con rol `admin`. Los UUID se validan en parámetros de ruta y los DTOs se validan mediante el `ValidationPipe` global.

Un usuario solo puede consultar su propio perfil y sus propias órdenes, y crear compras para su cuenta. Los administradores pueden consultar perfiles y órdenes de otros usuarios y crear compras para ellos. Intentar acceder a datos ajenos sin ese rol devuelve 403.

| Método | Ruta                            | Acceso        | Descripción                                               |
| ------ | ------------------------------- | ------------- | --------------------------------------------------------- |
| GET    | `/`                             | Público       | Estado de la API                                          |
| POST   | `/auth/signup`                  | Público       | Registro y emisión de JWT                                 |
| POST   | `/auth/signin`                  | Público       | Inicio de sesión y emisión de JWT                         |
| GET    | `/auth`                         | Público       | Estado del módulo de autenticación                        |
| GET    | `/users`                        | Administrador | Lista usuarios                                            |
| GET    | `/users/:id`                    | Usuario       | Consulta usuario por UUID                                 |
| PUT    | `/users/:id`                    | Administrador | Actualiza un usuario                                      |
| DELETE | `/users/:id`                    | Administrador | Elimina un usuario                                        |
| POST   | `/products`                     | Administrador | Crea producto                                             |
| POST   | `/products/seeder`              | Administrador | Precarga productos y categorías faltantes sin duplicarlos |
| POST   | `/products/seeder/reset`        | Administrador | Reinicia el catálogo si no hay productos comprados        |
| GET    | `/products`                     | Público       | Lista productos disponibles                               |
| GET    | `/products/:id`                 | Público       | Consulta producto por UUID                                |
| PUT    | `/products/:id`                 | Administrador | Actualiza producto                                        |
| DELETE | `/products/:id`                 | Administrador | Elimina producto                                          |
| GET    | `/categories`                   | Público       | Lista categorías                                          |
| GET    | `/categories/:id`               | Público       | Consulta categoría por UUID                               |
| POST   | `/categories`                   | Administrador | Crea categoría                                            |
| POST   | `/categories/seeder`            | Administrador | Precarga categorías sin duplicarlas                       |
| PUT    | `/categories/:id`               | Administrador | Actualiza categoría                                       |
| DELETE | `/categories/:id`               | Administrador | Elimina categoría; los productos quedan sin categoría     |
| POST   | `/orders`                       | Usuario       | Crea orden y descuenta una unidad por producto            |
| GET    | `/orders`                       | Administrador | Lista órdenes                                             |
| GET    | `/orders/:id`                   | Usuario       | Consulta orden por UUID                                   |
| PUT    | `/orders/:id`                   | Administrador | Actualiza usuario o productos de una orden y ajusta stock |
| DELETE | `/orders/:id`                   | Administrador | Elimina orden y devuelve sus unidades al stock            |
| POST   | `/files/uploadImage/:productId` | Administrador | Sube imagen y actualiza `imgUrl` del producto             |

## DTOs de solicitud

### `SignupUserDto` (`POST /auth/signup`)

Hereda `CreateUserDto` y agrega `confirmPassword`; las contraseñas deben coincidir.

| Campo             | Validación                                                                  |
| ----------------- | --------------------------------------------------------------------------- |
| `name`            | Cadena, 3–50 caracteres                                                     |
| `email`           | Correo válido, máximo 50 caracteres                                         |
| `password`        | 8–15 caracteres; minúscula, mayúscula, número y uno de `!@#$%^&*`           |
| `confirmPassword` | Cadena no vacía igual a `password`                                          |
| `address`         | Cadena, 3–80 caracteres                                                     |
| `phone`           | Entero entre -2147483648 y 2147483647, compatible con la columna PostgreSQL |
| `country`, `city` | Cadenas de 5–20 caracteres                                                  |

El registro almacena el hash bcrypt en una columna de hasta 255 caracteres y devuelve el usuario sin contraseña ni indicador administrativo, junto con `accessToken`. El límite de 255 corresponde al hash almacenado; la contraseña recibida se valida con el límite de 8–15 caracteres indicado arriba.

La consigna original combina un nombre de hasta 80 caracteres en el DTO con una entidad limitada a 50. Este proyecto mantiene el límite de 50 tanto en la API como en PostgreSQL para que una entrada aceptada pueda persistirse.

### `LoginUserDto` (`POST /auth/signin`)

Recibe `email` y `password`. Una credencial incorrecta devuelve el mismo error genérico. El JWT dura una hora.

### `UpdateUserDto` (`PUT /users/:id`)

Todos los campos de `CreateUserDto` son opcionales. Si se cambia `password`, se vuelve a hashear.

En los DTOs de actualización se pueden omitir propiedades; enviarlas explícitamente como `null` devuelve 400. Cambiar un correo por uno que ya existe devuelve 409.

### `CreateProductDto` (`POST /products`)

`name` (1–50 caracteres), `description` (cadena no compuesta solo por espacios), `price` (número entre 0 y 99999999.99 con hasta dos decimales), `stock` (entero entre 0 y 2147483647), `categoryId` (UUID de categoría existente) e `imgUrl` opcional (URL válida).

Al crear, `imgUrl` puede omitirse o enviarse vacío para utilizar la imagen por defecto. Si se envía un valor no vacío, debe ser una URL válida; el texto `"string"` no es una URL.

### `UpdateProductDto` (`PUT /products/:id`)

Todos los campos de `CreateProductDto` son opcionales.

Omitir `imgUrl` o enviarlo vacío conserva la imagen actual del producto.

`DELETE /products/:id` devuelve 409 si el producto está asociado a una orden de compra. La comprobación y el borrado se realizan en una transacción con bloqueo del producto para conservar el historial incluso ante una compra simultánea.

### `CreateCategoryDto` y `UpdateCategoryDto`

`CreateCategoryDto` recibe `name` como cadena de 2–50 caracteres. En `UpdateCategoryDto`, el campo es opcional.

### `CreateOrderDto` (`POST /orders`)

Recibe `userId` (UUID) y `products` (array no vacío de objetos `{ "id": "<UUID del producto>" }`). Cada producto se compra en una unidad y debe tener stock.

El total tampoco puede superar 99999999.99. La creación, modificación y eliminación de órdenes utilizan transacciones y bloquean los productos involucrados para conservar el stock ante operaciones concurrentes. Una actualización de producto o imagen escribe solo los campos solicitados.

### `UpdateOrderDto` (`PUT /orders/:id`)

Permite cambiar opcionalmente `userId` y/o `products`, con las mismas reglas de `CreateOrderDto`. El cambio se realiza en una transacción y ajusta el stock.

### Carga de imagen (`POST /files/uploadImage/:productId`)

El parámetro `productId` es el UUID del producto. Envía el archivo como `file` en `multipart/form-data`. Solo acepta JPEG, PNG o WebP y el tamaño máximo inclusivo es 204800 bytes (200 KiB). Se comprueba el contenido del archivo, además de su tamaño.

Cada subida crea un recurso nuevo en Cloudinary. Si falla la actualización de PostgreSQL, se intenta eliminar ese recurso nuevo sin reemplazar la imagen anterior. Las imágenes anteriores de actualizaciones exitosas se conservan en Cloudinary.

## Respuestas y entidades

Los esquemas manuales de Swagger se encuentran en la carpeta `schemas` de cada módulo que los utiliza; los controladores los importan en sus anotaciones. Las respuestas que usan entidades o DTOs conservan su documentación mediante `@ApiProperty`. `UploadImageResponseDto` documenta la respuesta de carga de imagen. Las entidades TypeORM `User`, `Product`, `Category`, `Order` y `OrderDetail` se publican como esquemas reutilizables en Swagger; sus relaciones se crean mediante la sincronización de TypeORM. Los precios de productos y detalles de órdenes se devuelven como cadenas decimales, por ejemplo `"199.99"`; al crear o actualizar un producto, el precio de entrada sigue siendo numérico.

## Crear un administrador y utilizar la precarga

El registro nunca permite asignar el rol. Para habilitar una cuenta de administrador de forma controlada en PostgreSQL:

```sql
UPDATE users SET admin = true WHERE email = 'correo-admin@ejemplo.com';
```

Inicia sesión otra vez para obtener un JWT con el rol actualizado.

Los 12 productos y las 4 categorías originales se conservan en `src/products/examples/products.examples.ts`, junto con los ejemplos de Swagger y las pruebas. El servidor no inserta datos al arrancar: la precarga se realiza mediante peticiones a los seeders. El backend proporciona las rutas de precarga y reinicio. Para completar el criterio **Muy bueno** de la rúbrica, el cliente debe invocarlas al iniciar; este repositorio contiene únicamente el backend y no implementa ese arranque del cliente.

La precarga solo inserta nombres que faltan. Repetir los seeders conserva los UUID, stock, precios e imágenes de los productos existentes, incluso si ya fueron comprados. No repone automáticamente el inventario vendido.

Para trabajar con Swagger o Thunder Client, inicia el backend, inicia sesión con una cuenta de administrador y envía primero `POST /categories/seeder` y después `POST /products/seeder`, antes de operar con el catálogo. Ambas peticiones se envían sin cuerpo y con el JWT de administrador. Este es un flujo manual: abrir Swagger o Thunder Client no ejecuta las peticiones automáticamente. Si después se incorpora una aplicación cliente, esas dos llamadas deben conectarse a su arranque autenticado.

1. `POST /categories/seeder`: crea las categorías faltantes y devuelve la lista completa.
2. `POST /products/seeder`: crea los productos faltantes. También garantiza que sus categorías existan antes de insertarlos. Devuelve `categoriesCreated` y `productsCreated`; si todo ya existe, ambos contadores son cero.
3. `POST /products/seeder/reset`: reemplaza **todos los productos y categorías actuales**, incluidos los creados manualmente, por los ejemplos originales. Devuelve 200 al completar el reinicio; conserva las cuentas de usuario y las órdenes.

El reinicio se rechaza con **409** si algún producto está asociado a una orden de compra, para conservar los detalles de las compras. También devuelve 409 si otra transacción está modificando el catálogo. La comprobación y el reinicio se realizan en una sola transacción con bloqueos de tablas, para impedir una compra simultánea entre ambos pasos. Si algo falla, se revierte toda la operación. El reinicio solo se ejecuta al solicitar su endpoint.

Puedes seguir creando los ejemplos manualmente con `POST /categories` y `POST /products`, usando el UUID de categoría como `categoryId`. Si el nombre ya está cargado, estas rutas normales devuelven 409.

## Comprobaciones locales

```bash
npm run build
npm run lint
npm test -- --runInBand
```

Para probar los flujos HTTP contra PostgreSQL real:

```bash
npm run test:integration
```

Esta suite usa las variables de conexión locales, crea un esquema temporal `logic_test_*`, sincroniza las entidades y elimina ese esquema al terminar. El usuario PostgreSQL necesita permiso para crear esquemas. Las tablas de la aplicación quedan fuera de ese esquema. Cloudinary se simula para no subir imágenes reales. Se prueban autenticación, compras, rollback, stock concurrente, sincronización repetida sin pérdida de los datos de prueba, inicio del servidor sin precarga automática, seeders por peticiones sin duplicados, reinicio del catálogo y su bloqueo ante compras o modificaciones concurrentes, creación manual de los ejemplos, validaciones y actualización de imágenes.
