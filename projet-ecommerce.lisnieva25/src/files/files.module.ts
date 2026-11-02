import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { cloudinaryProvider } from '../config/cloudinary.config';
import { Product } from '../products/entities/product.entity';
import { FilesController } from './files.controller';
import { FilesRepository } from './files.repository';
import { FilesService } from './files.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Product]), AuthModule],
  controllers: [FilesController],
  providers: [cloudinaryProvider, FilesRepository, FilesService],
})
export class FilesModule {}
