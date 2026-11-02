import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function createTypeOrmConfig(
  config: ConfigService,
): TypeOrmModuleOptions {
  const portValue = config.get<string>('DB_PORT', '5432');
  const port = Number(portValue);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `DB_PORT debe ser un puerto válido; se recibió "${portValue}".`,
    );
  }

  const database =
    config.get<string>('DB_DATABASE')?.trim() ||
    config.get<string>('DB_NAME')?.trim();

  if (!database) {
    throw new Error('Falta configurar DB_DATABASE (o DB_NAME).');
  }

  return {
    type: 'postgres',
    host: config.getOrThrow<string>('DB_HOST'),
    port,
    username: config.getOrThrow<string>('DB_USERNAME'),
    password: config.getOrThrow<string>('DB_PASSWORD'),
    database,
    autoLoadEntities: true,
    synchronize: true,
    dropSchema: false,
    logging: false,
  };
}
