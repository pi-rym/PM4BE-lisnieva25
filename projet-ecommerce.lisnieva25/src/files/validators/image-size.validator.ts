import { FileValidator } from '@nestjs/common';

export const MAX_IMAGE_SIZE = 200 * 1024;

export class ImageSizeValidator extends FileValidator<{ maxSize: number }> {
  isValid(file?: Parameters<FileValidator['isValid']>[0]): boolean {
    return (
      !!file &&
      !Array.isArray(file) &&
      typeof file.size === 'number' &&
      file.size <= this.validationOptions.maxSize
    );
  }

  buildErrorMessage(): string {
    return `La imagen no puede superar ${this.validationOptions.maxSize} bytes`;
  }
}
