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

// Check if we're in mock mode (no connection string)
const isLocalStorage = !connectionString || connectionString.trim() === '';

// Create local storage directory if needed
if (isLocalStorage && !fs.existsSync(localStoragePath)) {
  fs.mkdirSync(localStoragePath, { recursive: true });
  console.log(`Created local storage directory at ${localStoragePath}`);
}

// Initialize the BlobServiceClient only if we have a connection string
let blobServiceClient: BlobServiceClient | null = null;
let containerClient: ContainerClient | null = null;

if (!isLocalStorage) {
  try {
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    containerClient = blobServiceClient.getContainerClient(containerName);
    console.log('Azure Blob Storage client initialized');
  } catch (error) {
    console.error('Failed to initialize Azure Blob Storage client:', error);
    console.log('Falling back to local storage');
  }
}

/**
 * Ensure the container exists before any operation
 */
export async function ensureContainer() {
  if (isLocalStorage) {
    return; // No need to create container for local storage
  }
  
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
    
    if (isLocalStorage) {
      // Store locally
      const dirPath = path.join(localStoragePath, customerId, documentType);
      
      // Create directories if they don't exist
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      const fullPath = path.join(dirPath, fileName);
      fs.writeFileSync(fullPath, file.buffer);
      
      console.log(`File saved locally: ${fullPath}`);
      return fullPath;
    } else {
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
    }
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
    if (isLocalStorage) {
      // For local storage, just return the path
      return blobUrl;
    } else {
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
    }
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
    if (isLocalStorage) {
      // Delete the local file
      if (fs.existsSync(blobUrl)) {
        fs.unlinkSync(blobUrl);
        console.log(`Local file deleted: ${blobUrl}`);
      }
    } else {
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
    }
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
    // Check if we're in production environment
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Check if Azure credentials are properly configured
    if (!this.connectionString || this.connectionString.trim() === '') {
      if (isProduction) {
        // In production, we should always have a connection string
        console.error('CRITICAL ERROR: Azure Blob Storage connection string not found in production environment');
        console.error('Documents will not be stored correctly. Please configure AZURE_STORAGE_CONNECTION_STRING');
        // Still try to initialize with Azure - this will fail but it's better than silently using local storage
        this.isLocalStorage = false;
      } else {
        // In development, we can fall back to local storage
        console.log('Azure Blob Storage connection string not found, using local storage fallback');
        this.isLocalStorage = true;
        
        // Create local storage directory if needed
        if (!fs.existsSync(this.localStoragePath)) {
          fs.mkdirSync(this.localStoragePath, { recursive: true });
          console.log(`Created local storage directory at ${this.localStoragePath}`);
        }
      }
    } else {
      try {
        // Create the BlobServiceClient from connection string
        this.blobServiceClient = BlobServiceClient.fromConnectionString(this.connectionString);
        console.log('Azure Blob Storage client initialized successfully');
        this.isLocalStorage = false;
      } catch (error) {
        console.error('Failed to initialize Azure Blob Storage client:', error);
        
        if (isProduction) {
          // In production, this is a critical error
          console.error('CRITICAL ERROR: Failed to initialize Azure Blob Storage in production environment');
          console.error('Documents will not be stored correctly');
          // Still mark as Azure storage - this will fail but it's better than silently using local storage
          this.isLocalStorage = false;
        } else {
          // In development, we can fall back to local storage
          console.log('Falling back to local storage');
          this.isLocalStorage = true;
          
          // Create local storage directory if needed
          if (!fs.existsSync(this.localStoragePath)) {
            fs.mkdirSync(this.localStoragePath, { recursive: true });
            console.log(`Created local storage directory at ${this.localStoragePath}`);
          }
        }
      }
    }
  }

  /**
   * Upload a file to Azure Blob Storage or local storage with improved security
   */
  async uploadFile(
    clientId: string,
    documentType: string,
    fileName: string,
    fileContent: Buffer,
    contentType: string
  ): Promise<{ url: string, path: string }> {
    try {
      // Create a path for the blob/file: clientId/documentType/filename
      const blobPath = `${clientId}/${documentType}/${fileName}`;
      
      if (this.isLocalStorage) {
        // Store locally
        const dirPath = path.join(this.localStoragePath, clientId, documentType);
        
        // Create directories if they don't exist
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        
        const fullPath = path.join(dirPath, fileName);
        fs.writeFileSync(fullPath, fileContent);
        
        console.log(`File saved locally: ${fullPath}`);
        
        // Return a local file path
        return {
          url: fullPath,
          path: blobPath
        };
      } else {
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
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error('Failed to upload file to storage');
    }
  }

  /**
   * Generate a secure URL with a short-lived SAS token for a specific blob
   * For local storage, just returns the file path
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
      
      if (this.isLocalStorage) {
        // For local storage, just return the file path
        const fullPath = path.join(this.localStoragePath, clientId, documentType, fileName);
        
        if (!fs.existsSync(fullPath)) {
          console.error(`File not found at path: ${fullPath}`);
          throw new Error('File not found');
        }
        
        console.log(`Returning local file path: ${fullPath}`);
        return fullPath;
      } else {
        if (!this.blobServiceClient) {
          console.error('Blob service client is not initialized');
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
            console.log(`Returning local file path: ${localPath}`);
            return localPath;
          }
        }
        
        // Generate SAS token
        const sasOptions = {
          expiresOn: new Date(new Date().valueOf() + expirySeconds * 1000),
          permissions: BlobSASPermissions.parse('r'), // Read permission
        };
        
        const sasToken = await blobClient.generateSasUrl(sasOptions);
        return sasToken;
      }
    } catch (error) {
      console.error('Error generating secure URL:', error);
      throw error;
    }
  }

  /**
   * Delete a file from storage
   * @param clientId The client ID
   * @param documentType The document type
   * @param fileName The file name
   * @returns true if the file was deleted, false if it wasn't found
   */
  async deleteFile(
    clientId: string,
    documentType: string,
    fileName: string
  ): Promise<boolean> {
    try {
      console.log(`Deleting file: ${clientId}/${documentType}/${fileName}`);
      
      // Create the blob/file path
      const blobPath = `${clientId}/${documentType}/${fileName}`;
      
      if (this.isLocalStorage) {
        // For local storage, delete the file
        const fullPath = path.join(this.localStoragePath, clientId, documentType, fileName);
        
        if (!fs.existsSync(fullPath)) {
          console.log(`File not found at path: ${fullPath}`);
          return false;
        }
        
        fs.unlinkSync(fullPath);
        console.log(`Local file deleted: ${fullPath}`);
        return true;
      } else {
        if (!this.blobServiceClient) {
          console.error('Blob service client is not initialized');
          throw new Error('Blob service client is not initialized');
        }
        
        // Get a container client
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        
        // Get a block blob client
        const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
        
        // Check if blob exists
        const exists = await blockBlobClient.exists();
        
        if (!exists) {
          console.log(`Blob not found: ${blobPath}`);
          
          // Try to check if the file exists in local storage as a fallback
          const localPath = path.join(this.localStoragePath, clientId, documentType, fileName);
          if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath);
            console.log(`Local file deleted as fallback: ${localPath}`);
            return true;
          }
          
          return false;
        }
        
        // Delete the blob
        await blockBlobClient.delete();
        console.log(`Blob deleted from Azure: ${blobPath}`);
        return true;
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Ensure the container exists before any operation
   */
  async ensureContainer() {
    if (this.isLocalStorage) {
      return; // No need to create container for local storage
    }
    
    try {
      if (this.blobServiceClient) {
        await this.blobServiceClient.getContainerClient(this.containerName).createIfNotExists();
        console.log(`Container '${this.containerName}' created or already exists.`);
      }
    } catch (error) {
      console.error(`Error creating container '${this.containerName}':`, error);
      throw error;
    }
  }
}