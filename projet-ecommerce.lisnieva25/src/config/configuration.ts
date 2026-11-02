import { registerAs } from '@nestjs/config';

export const configuration = registerAs('app', () => ({
  host: process.env.HOST ?? 'localhost',
  port: Number(process.env.PORT ?? 3000),
}));
