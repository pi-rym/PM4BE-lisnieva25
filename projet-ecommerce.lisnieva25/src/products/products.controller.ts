import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import {
  CreateProductDto,
  UpdateProductDto,
  CatalogSeedResultDto,
} from './dto/product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role, Roles } from '../auth/roles/roles';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { productIdResponseSchema } from './schemas/products.schemas';

@ApiTags('Productos')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear un producto' })
  @ApiResponse({ status: 201, schema: productIdResponseSchema })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Post('seeder')
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Precargar el catálogo sin duplicados',
    description:
      'Crea primero las categorías faltantes. Conserva los productos existentes, incluido su stock e imagen.',
  })
  @ApiResponse({ status: 201, type: CatalogSeedResultDto })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, inválido o vencido',
  })
  @ApiResponse({ status: 403, description: 'Requiere rol administrador' })
  seedProducts() {
    return this.productsService.seedProducts();
  }

  @Post('seeder/reset')
  @HttpCode(200)
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reiniciar el catálogo de ejemplo',
    description:
      'Elimina todos los productos y categorías actuales y restaura los 12 productos y 4 categorías de ejemplo. Se rechaza si algún producto está asociado a una orden o si el catálogo está siendo modificado. No elimina usuarios ni órdenes.',
  })
  @ApiResponse({ status: 200, type: CatalogSeedResultDto })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, inválido o vencido',
  })
  @ApiResponse({ status: 403, description: 'Requiere rol administrador' })
  @ApiResponse({
    status: 409,
    description:
      'Hay productos comprados o una modificación concurrente del catálogo',
  })
  resetProducts() {
    return this.productsService.resetProducts();
  }

  @Get()
  @ApiOperation({ summary: 'Listar productos con stock' })
  @ApiResponse({ status: 200, type: Product, isArray: true })
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consultar un producto' })
  @ApiResponse({ status: 200, type: Product })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Actualizar un producto' })
  @ApiResponse({ status: 200, schema: productIdResponseSchema })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Eliminar un producto sin compras' })
  @ApiResponse({ status: 200, schema: productIdResponseSchema })
  @ApiResponse({
    status: 409,
    description: 'El producto está asociado a órdenes de compra',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(id);
  }
}
