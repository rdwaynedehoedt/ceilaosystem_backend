import sharp from 'sharp';
import { extname } from 'path';

/**
 * Utility class for optimizing images before uploading to Azure Blob Storage
 */
export class ImageOptimizer {
  /**
   * Maximum dimensions for images (preserves aspect ratio)
   */
  private static readonly MAX_WIDTH = 1920;
  private static readonly MAX_HEIGHT = 1080;
  
  /**
   * Quality settings for different formats
   */
  private static readonly JPEG_QUALITY = 80;
  private static readonly PNG_QUALITY = 80;
  private static readonly WEBP_QUALITY = 75;
  
  /**
   * Check if a file is an image based on its mimetype
   */
  static isImage(mimetype: string): boolean {
    return mimetype.startsWith('image/');
  }
  
  /**
   * Optimize an image buffer
   * @param buffer The original image buffer
   * @param mimetype The mimetype of the image
   * @param filename The original filename
   * @returns An object containing the optimized buffer, new mimetype, and extension
   */
  static async optimizeImage(
    buffer: Buffer,
    mimetype: string,
    filename: string
  ): Promise<{ 
    buffer: Buffer; 
    mimetype: string; 
    extension: string;
    compressionRate: number;
  }> {
    try {
      // If it's not an image, return the original buffer
      if (!this.isImage(mimetype)) {
        return { 
          buffer, 
          mimetype, 
          extension: extname(filename),
          compressionRate: 1
        };
      }
      
      const originalSize = buffer.length;
      let image = sharp(buffer);
      
      // Get image metadata
      const metadata = await image.metadata();
      
      // Resize if the image is larger than the maximum dimensions
      if (
        metadata.width && 
        metadata.height && 
        (metadata.width > this.MAX_WIDTH || metadata.height > this.MAX_HEIGHT)
      ) {
        image = image.resize({
          width: this.MAX_WIDTH,
          height: this.MAX_HEIGHT,
          fit: 'inside',
          withoutEnlargement: true
        });
      }
      
      // Determine the best format to use
      let optimizedBuffer: Buffer;
      let newMimetype: string;
      let extension: string;
      
      // Convert to WebP if supported by the client (check Accept header)
      // For now, we'll use the original format for better compatibility
      if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') {
        optimizedBuffer = await image.jpeg({ quality: this.JPEG_QUALITY }).toBuffer();
        newMimetype = 'image/jpeg';
        extension = '.jpg';
      } else if (mimetype === 'image/png') {
        optimizedBuffer = await image.png({ quality: this.PNG_QUALITY }).toBuffer();
        newMimetype = 'image/png';
        extension = '.png';
      } else if (mimetype === 'image/webp') {
        optimizedBuffer = await image.webp({ quality: this.WEBP_QUALITY }).toBuffer();
        newMimetype = 'image/webp';
        extension = '.webp';
      } else {
        // For other formats, just return the original
        return { 
          buffer, 
          mimetype, 
          extension: extname(filename),
          compressionRate: 1
        };
      }
      
      // Calculate compression rate
      const compressionRate = originalSize / optimizedBuffer.length;
      
      console.log(`Image optimized: ${filename}`);
      console.log(`Original size: ${(originalSize / 1024).toFixed(2)}KB`);
      console.log(`Optimized size: ${(optimizedBuffer.length / 1024).toFixed(2)}KB`);
      console.log(`Compression rate: ${compressionRate.toFixed(2)}x`);
      
      return {
        buffer: optimizedBuffer,
        mimetype: newMimetype,
        extension,
        compressionRate
      };
    } catch (error) {
      console.error('Error optimizing image:', error);
      // Return the original buffer if optimization fails
      return { 
        buffer, 
        mimetype, 
        extension: extname(filename),
        compressionRate: 1
      };
    }
  }
} 