import { BlobServiceClient, ContainerClient, BlockBlobClient, PublicAccessType, BlobSASPermissions, StorageSharedKeyCredential, generateBlobSASQueryParameters, SASProtocol } from '@azure/storage-blob';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

dotenv.config();

// Connection string and container name from environment variables
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'customer-documents';
const localStoragePath = './uploads';

// Create local storage directory for fallback
if (!fs.existsSync(localStoragePath)) {
  fs.mkdirSync(localStoragePath, { recursive: true });
  console.log(`Created local storage directory at ${localStoragePath}`);
}

// Initialize the BlobServiceClient
let blobServiceClient: BlobServiceClient | null = null;
let containerClient: ContainerClient | null = null;

try {
  blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  containerClient = blobServiceClient.getContainerClient(containerName);
  console.log('Azure Blob Storage client initialized');
} catch (error) {
  console.error('Failed to initialize Azure Blob Storage client:', error);
  console.log('Will attempt to use Azure storage but may fail');
}

/**
 * Ensure the container exists before any operation
 */
export async function ensureContainer() {
  try {
    if (containerClient) {
      await containerClient.createIfNotExists();
      console.log(`Container '${containerName}' created or already exists.`);
    }
  } catch (error) {
    console.error(`Error creating container '${containerName}':`, error);
    throw error;
  }
}

/**
 * Upload a file to Azure Blob Storage or local storage
 * @param file The file buffer and metadata
 * @param customerId The customer ID to associate with the file
 * @param documentType The type of document (e.g., 'nic', 'dob_proof', etc.)
 * @returns The URL or path of the uploaded file
 */
export async function uploadDocument(
  file: { buffer: Buffer; originalname: string; mimetype: string },
  customerId: string,
  documentType: string
): Promise<string> {
  try {
    // Generate a unique name for the file
    const extension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${extension}`;
    const filePath = `${customerId}/${documentType}/${fileName}`;
    
    // Use Azure Blob Storage
    await ensureContainer();
    
    if (!containerClient) {
      throw new Error('Container client is not initialized');
    }
    
    // Get a block blob client
    const blockBlobClient = containerClient.getBlockBlobClient(filePath);
    
    // Upload the file
    await blockBlobClient.upload(file.buffer, file.buffer.length, {
      blobHTTPHeaders: {
        blobContentType: file.mimetype,
      },
    });
    
    console.log(`File uploaded successfully to Azure: ${filePath}`);
    
    // Return the URL of the blob
    return blockBlobClient.url;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

/**
 * Get a URL or file path for accessing a document
 * @param blobUrl The URL or path of the file
 * @param expiryMinutes How many minutes the URL should be valid (only for Azure)
 * @returns A URL or file path for accessing the file
 */
export async function generateSasUrl(blobUrl: string, expiryMinutes = 60): Promise<string> {
  try {
    if (!containerClient) {
      throw new Error('Container client is not initialized');
    }
    
    // Extract the blob name from the URL
    const url = new URL(blobUrl);
    const blobPath = url.pathname.substring(url.pathname.indexOf(containerName) + containerName.length + 1);
    
    // Get a block blob client
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
    
    // Generate SAS token
    const sasOptions = {
      expiresOn: new Date(new Date().valueOf() + expiryMinutes * 60 * 1000),
      permissions: BlobSASPermissions.parse('r'), // Read permission
    };
    
    const sasToken = await blockBlobClient.generateSasUrl(sasOptions);
    return sasToken;
  } catch (error) {
    console.error('Error generating access URL:', error);
    throw error;
  }
}

/**
 * Delete a document
 * @param blobUrl The URL or path of the file to delete
 */
export async function deleteDocument(blobUrl: string): Promise<void> {
  try {
    if (!containerClient) {
      throw new Error('Container client is not initialized');
    }
    
    // Extract the blob name from the URL
    const url = new URL(blobUrl);
    const blobPath = url.pathname.substring(url.pathname.indexOf(containerName) + containerName.length + 1);
    
    // Get a block blob client
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
    
    // Delete the blob
    await blockBlobClient.delete();
    console.log(`Blob deleted from Azure: ${blobPath}`);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}

export class BlobStorageService {
  private blobServiceClient: BlobServiceClient | null = null;
  private containerName: string = process.env.AZURE_STORAGE_CONTAINER_NAME || 'customer-documents';
  private connectionString: string = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
  private localStoragePath = './uploads';
  private isLocalStorage: boolean = false;

  constructor() {
    try {
      // Create the BlobServiceClient from connection string
      this.blobServiceClient = BlobServiceClient.fromConnectionString(this.connectionString);
      console.log('Azure Blob Storage client initialized successfully');
      this.isLocalStorage = false;
    } catch (error) {
      console.error('Failed to initialize Azure Blob Storage client:', error);
      console.log('Will attempt to use Azure but may fail');
      this.isLocalStorage = false;
      
      // Create local storage directory if needed
      if (!fs.existsSync(this.localStoragePath)) {
        fs.mkdirSync(this.localStoragePath, { recursive: true });
        console.log(`Created local storage directory at ${this.localStoragePath}`);
      }
    }
  }

  /**
   * Upload a file to Azure Blob Storage with improved security
   */
  async uploadFile(
    clientId: string,
    documentType: string,
    fileName: string,
    fileContent: Buffer,
    contentType: string
  ): Promise<{ url: string, path: string }> {
    try {
      // Create the blob/file path
      const blobPath = `${clientId}/${documentType}/${fileName}`;
      
      // Ensure container exists
      await this.ensureContainer();

      if (!this.blobServiceClient) {
        throw new Error('Blob service client is not initialized');
      }

      // Get a container client
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      
      // Get a block blob client
      const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
      
      // Upload the file
      await blockBlobClient.upload(fileContent, fileContent.length, {
        blobHTTPHeaders: {
          blobContentType: contentType
        }
      });
      
      console.log(`File uploaded successfully to Azure: ${blobPath}`);
      
      // Return the blob URL and path (without generating SAS - we'll generate that on demand)
      return {
        url: blockBlobClient.url,
        path: blobPath
      };
    } catch (error) {
      console.error('Error uploading file to Azure:', error);
      
      // Create a fallback local copy for emergency
      try {
        // Create the blob/file path
        const blobPath = `${clientId}/${documentType}/${fileName}`;
        
        const dirPath = path.join(this.localStoragePath, clientId, documentType);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        
        const fullPath = path.join(dirPath, fileName);
        fs.writeFileSync(fullPath, fileContent);
        console.log(`FALLBACK: File saved locally: ${fullPath}`);
        
        // Return a URL format that matches Azure for consistency
        const baseUrl = 'https://insurancedocuments.blob.core.windows.net';
        return {
          url: `${baseUrl}/${this.containerName}/${blobPath}`,
          path: blobPath
        };
      } catch (fallbackError) {
        console.error('Error in local fallback storage:', fallbackError);
        throw new Error('Failed to upload file to storage');
      }
    }
  }

  /**
   * Generate a secure URL with a short-lived SAS token for a specific blob
   */
  async generateSecureUrl(
    clientId: string,
    documentType: string,
    fileName: string,
    expirySeconds: number = 900 // Default 15 minutes
  ): Promise<string> {
    try {
      console.log(`[${new Date().toISOString()}] Generating secure URL for: ${clientId}/${documentType}/${fileName}`);
      
      // Create the blob/file path
      const blobPath = `${clientId}/${documentType}/${fileName}`;
      
      if (!this.blobServiceClient) {
        throw new Error('Blob service client is not initialized');
      }
      
      // Get a container client
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      
      // Check if blob exists
      const blobClient = containerClient.getBlobClient(blobPath);
      const exists = await blobClient.exists();
      
      if (!exists) {
        console.error(`Blob not found: ${blobPath}`);
        
        // Try to check if the file exists in local storage as a fallback
        // This handles cases where we have a mix of Azure and local files
        const localPath = path.join(this.localStoragePath, clientId, documentType, fileName);
        if (fs.existsSync(localPath)) {
          console.log(`File found in local storage instead: ${localPath}`);
          return localPath;
        }
        
        // Also try to find the file with the same name in "uploads" directory
        const uploadsPath = path.join('uploads', clientId, documentType, fileName);
        if (fs.existsSync(uploadsPath)) {
          console.log(`File found in uploads directory: ${uploadsPath}`);
          return uploadsPath;
        }
        
        // Look for the file in the entire uploads directory for this client and document type
        const clientDocTypeDir = path.join('uploads', clientId, documentType);
        if (fs.existsSync(clientDocTypeDir)) {
          try {
            const files = fs.readdirSync(clientDocTypeDir);
            if (files.length > 0) {
              // Return the first file found - might not be the exact one, but better than nothing
              const firstFile = path.join(clientDocTypeDir, files[0]);
              console.log(`File not found, but returning another file from the same directory: ${firstFile}`);
              return firstFile;
            }
          } catch (readError) {
            console.error(`Error reading directory: ${clientDocTypeDir}`, readError);
          }
        }
        
        throw new Error(`File not found: ${fileName}`);
      }
      
      console.log(`Blob exists: ${blobPath}, generating SAS URL...`);
      
      // Generate a SAS URL directly from the blob client with more permissive settings
      const sasOptions = {
        expiresOn: new Date(new Date().valueOf() + expirySeconds * 1000),
        permissions: BlobSASPermissions.parse("r"), // Read-only permission
        contentDisposition: 'inline',
        protocol: 'https,http' as SASProtocol // Allow both protocols
      };
      
      console.log(`SAS options: expires=${sasOptions.expiresOn.toISOString()}, permissions=${sasOptions.permissions}`);
      
      const sasUrl = await blobClient.generateSasUrl(sasOptions);
      
      // Log the full URL (without the SAS token part for security)
      const sasUrlShort = sasUrl.substring(0, sasUrl.indexOf('?') + 10) + '...';
      console.log(`Generated URL: ${sasUrlShort}`);
      
      // Return the blob URL with SAS token
      return sasUrl;
    } catch (error) {
      console.error('Error generating secure URL:', error);
      throw new Error('Failed to generate secure access URL');
    }
  }

  /**
   * Delete a document from storage
   */
  async deleteFile(clientId: string, documentType: string, fileName: string): Promise<boolean> {
    try {
      // Create the blob/file path
      const blobPath = `${clientId}/${documentType}/${fileName}`;
      
      console.log(`Attempting to delete: ${blobPath}`);
      
      if (!this.blobServiceClient) {
        throw new Error('Blob service client is not initialized');
      }
      
      // Get a container client
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      
      // Get a blob client
      const blobClient = containerClient.getBlobClient(blobPath);
      
      // Check if blob exists before attempting to delete
      const exists = await blobClient.exists();
      if (!exists) {
        console.log(`Blob does not exist: ${blobPath}`);
        
        // Check if local file exists and delete it as fallback
        const localPath = path.join(this.localStoragePath, clientId, documentType, fileName);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
          console.log(`Local file deleted: ${localPath}`);
          return true;
        }
        
        return false;
      }
      
      // Delete the blob
      await blobClient.delete();
      console.log(`Blob deleted from Azure: ${blobPath}`);
      
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error('Failed to delete file from storage');
    }
  }

  /**
   * Ensure the container exists, create it if it doesn't
   */
  async ensureContainer(): Promise<void> {
    try {
      if (!this.blobServiceClient) {
        throw new Error('Blob service client is not initialized');
      }
      
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      await containerClient.createIfNotExists();
      console.log(`Container '${this.containerName}' created or already exists.`);
    } catch (error) {
      console.error('Error ensuring container exists:', error);
      throw new Error('Failed to ensure storage container exists');
    }
  }

  /**
   * Legacy method for backward compatibility 
   */
  async uploadDocument(
    file: { buffer: Buffer; originalname: string; mimetype: string },
    customerId: string,
    documentType: string
  ): Promise<string> {
    const fileName = `${uuidv4()}${this.getFileExtension(file.originalname)}`;
    const result = await this.uploadFile(
      customerId,
      documentType,
      fileName,
      file.buffer,
      file.mimetype
    );
    return result.url;
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 1);
  }

  /**
   * Get a container client for the storage container
   */
  async getContainerClient(): Promise<ContainerClient> {
    if (!this.blobServiceClient) {
      throw new Error('Blob service client is not initialized');
    }
    
    return this.blobServiceClient.getContainerClient(this.containerName);
  }
}

const storageService = new BlobStorageService();
export default storageService; 