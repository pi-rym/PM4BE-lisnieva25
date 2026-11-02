import { jest } from '@jest/globals';
import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { FilesService } from '../src/files/files.service';
import { FilesRepository } from '../src/files/files.repository';
import { Product } from '../src/products/entities/product.entity';

describe('Coherencia al subir imágenes', () => {
  function setup() {
    const uploaded: { id?: string; overwrite?: boolean } = {};
    const destroy = jest
      .fn<typeof cloudinary.uploader.destroy>()
      .mockResolvedValue({ result: 'ok' });
    const client = {
      uploader: {
        destroy,
        upload_stream: (
          options: { public_id: string; overwrite: boolean },
          callback: Function,
        ) => {
          uploaded.id = options.public_id;
          uploaded.overwrite = options.overwrite;
          return {
            end: () =>
              callback(undefined, {
                secure_url: 'https://images.example/new.png',
                public_id: options.public_id,
              }),
          };
        },
      },
    } as unknown as typeof cloudinary;
    const repository = {
      getProductById: jest
        .fn<FilesRepository['getProductById']>()
        .mockResolvedValue({ id: 'product' } as Product),
      updateProductImage: jest
        .fn<FilesRepository['updateProductImage']>()
        .mockResolvedValue({
          id: 'product',
          imgUrl: 'https://images.example/new.png',
        } as Product),
    };
    return {
      uploaded,
      destroy,
      client,
      repository,
      service: new FilesService(
        client,
        repository as unknown as FilesRepository,
      ),
    };
  }

  it('elimina la imagen nueva si falla la DB y conserva el error original', async () => {
    const { service, repository, uploaded, destroy } = setup();
    const error = new Error('DB no disponible');
    repository.updateProductImage.mockRejectedValue(error);
    await expect(
      service.uploadProductImage('product', { buffer: Buffer.from('image') }),
    ).rejects.toBe(error);
    expect(uploaded.overwrite).toBe(false);
    expect(destroy).toHaveBeenCalledWith(uploaded.id, {
      resource_type: 'image',
    });
  });

  it('no sube nada si el producto ya no existe', async () => {
    const { service, repository, uploaded } = setup();
    repository.getProductById.mockRejectedValue(new NotFoundException());
    await expect(
      service.uploadProductImage('product', { buffer: Buffer.from('image') }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(uploaded.id).toBeUndefined();
  });

  it('transforma el fallo de Cloudinary en 502 sin intentar actualizar la DB', async () => {
    const { service, client, repository } = setup();
    client.uploader.upload_stream = ((
      _options: unknown,
      callback: Function,
    ) => ({
      end: () => callback(new Error('provider failure')),
    })) as unknown as typeof cloudinary.uploader.upload_stream;
    await expect(
      service.uploadProductImage('product', { buffer: Buffer.from('image') }),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(repository.updateProductImage).not.toHaveBeenCalled();
  });
});
