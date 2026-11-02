import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { CLOUDINARY_CLIENT } from '../config/cloudinary.config';
import { FilesRepository } from './files.repository';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  constructor(
    @Inject(CLOUDINARY_CLIENT)
    private readonly cloudinaryClient: typeof cloudinary,
    private readonly filesRepository: FilesRepository,
  ) {}

  async uploadProductImage(id: string, file: { buffer: Buffer }) {
    const product = await this.filesRepository.getProductById(id);
    const image = await this.uploadToCloudinary(id, file.buffer);
    try {
      const updatedProduct = await this.filesRepository.updateProductImage(
        product,
        image.url,
      );
      return { id: updatedProduct.id, imgUrl: updatedProduct.imgUrl };
    } catch (error) {

      
      // Una carga nueva no reemplaza la imagen anterior si falla la escritura en DB.
      try {
        await this.cloudinaryClient.uploader.destroy(image.publicId, {
          resource_type: 'image',
        });
      } catch {
        this.logger.warn(
          'No se pudo eliminar la imagen de una actualización fallida',
        );
      }
      throw error;
    }
  }

  private uploadToCloudinary(
    id: string,
    buffer: Buffer,
  ): Promise<{ url: string; publicId: string }> {
    const publicId = `products/${id}-${randomUUID()}`;
    return new Promise((resolve, reject) => {
      const stream = this.cloudinaryClient.uploader.upload_stream(
        {
          public_id: publicId,
          overwrite: false,
          resource_type: 'image',
        },
        (error, result) => {
          if (error)
            return reject(
              new BadGatewayException(
                'No se pudo cargar la imagen en Cloudinary',
              ),
            );
          if (!result?.secure_url) {
            return reject(
              new BadGatewayException('Cloudinary no devolvió una URL segura'),
            );
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id || publicId,
          });
        },
      );

      stream.end(buffer);
    });
  }
}
