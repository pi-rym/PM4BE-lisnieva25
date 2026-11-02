import {
  Controller,
  FileTypeValidator,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
  Param,
  UseGuards,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UploadImageResponseDto } from './dto/upload-image.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role, Roles } from '../auth/roles/roles';
import {
  ImageSizeValidator,
  MAX_IMAGE_SIZE,
} from './validators/image-size.validator';

import { uploadImageBodySchema } from './schemas/files.schemas';

@ApiTags('Archivos')
@Controller()
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('files/uploadImage/:productId')
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiParam({
    name: 'productId',
    format: 'uuid',
    description: 'ID del producto',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: uploadImageBodySchema,
  })
  @ApiOperation({ summary: 'Subir una imagen de producto' })
  @ApiResponse({ status: 201, type: UploadImageResponseDto })
  @UseInterceptors(
    FileInterceptor('file', {
      
      // Multer rechaza al alcanzar el límite; el pipe aplica el máximo inclusivo.
      limits: { fileSize: MAX_IMAGE_SIZE + 1 },
    }),
  )
  uploadImage(
    @Param('productId', ParseUUIDPipe) productId: string,

    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new ImageSizeValidator({ maxSize: MAX_IMAGE_SIZE }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: { buffer: Buffer },
  ) {
    return this.filesService.uploadProductImage(productId, file);
  }
}
