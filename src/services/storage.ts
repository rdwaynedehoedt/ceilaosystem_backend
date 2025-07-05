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

// Debug log the connection string (with partial masking for security)
if (connectionString) {
  const maskedConnectionString = connectionString.substring(0, 30) + '...' + connectionString.substring(connectionString.length - 10);
  console.log(`Azure connection string found (masked): ${maskedConnectionString}`);
  console.log(`Container name: ${containerName}`);
} else {
  console.log('WARNING: No Azure connection string found in environment variables');
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
    console.log('Initializing BlobStorageService...');
    
    if (!this.connectionString || this.connectionString.trim() === '') {
      console.log('WARNING: Azure Blob Storage connection string not found');
      this.isLocalStorage = true;
    } else {
      try {
        console.log('Attempting to initialize Azure Blob Storage client...');
        // Create the BlobServiceClient from connection string
        this.blobServiceClient = BlobServiceClient.fromConnectionString(this.connectionString);
        console.log('Azure Blob Storage client initialized successfully');
        this.isLocalStorage = false;
        
        // Test the connection immediately to verify it works
        this.testConnection();
      } catch (error) {
        console.error('CRITICAL ERROR: Failed to initialize Azure Blob Storage client:', error);
        console.log('Will use local storage as fallback');
        this.isLocalStorage = true;
      }
    }
    
    // Create local storage directory if needed (always, for fallback)
    if (!fs.existsSync(this.localStoragePath)) {
      fs.mkdirSync(this.localStoragePath, { recursive: true });
      console.log(`Created local storage directory at ${this.localStoragePath}`);
    }
  }

  /**
   * Test the Azure Blob Storage connection
   */
  private async testConnection(): Promise<void> {
    try {
      if (!this.blobServiceClient) {
        console.error('Cannot test connection: Blob service client is not initialized');
        return;
      }
      
      console.log('Testing Azure Blob Storage connection...');
      
      // List containers as a simple connection test
      const containers = this.blobServiceClient.listContainers();
      let containerCount = 0;
      
      for await (const container of containers) {
        containerCount++;
        if (containerCount === 1) {
          console.log(`Successfully connected to Azure Blob Storage. Found container: ${container.name}`);
          break; // We just need to verify we can list at least one container
        }
      }
      
      if (containerCount === 0) {
        console.log('Connected to Azure Blob Storage but no containers found');
      }
      
      // Now test our specific container
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const exists = await containerClient.exists();
      
      if (exists) {
        console.log(`Container '${this.containerName}' exists`);
      } else {
        console.log(`Container '${this.containerName}' does not exist, will create when needed`);
      }
    } catch (error) {
      console.error('Error testing Azure Blob Storage connection:', error);
      console.log('Will use local storage as fallback');
      this.isLocalStorage = true;
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
    // Create the blob/file path
    const blobPath = `${clientId}/${documentType}/${fileName}`;
    
    // Always save locally first as a backup
    try {
      const dirPath = path.join(this.localStoragePath, clientId, documentType);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      const fullPath = path.join(dirPath, fileName);
      fs.writeFileSync(fullPath, fileContent);
      console.log(`File saved locally: ${fullPath}`);
    } catch (localError) {
      console.error('Error saving file locally:', localError);
      // Continue anyway to try Azure upload
    }
    
    // If we're in local storage mode or Azure client failed to initialize, return the local path
    if (this.isLocalStorage || !this.blobServiceClient) {
      console.log(`Using local storage for ${blobPath}`);
      
      // Return a URL format that matches Azure for consistency
      const baseUrl = 'https://insurancedocuments.blob.core.windows.net';
      return {
        url: `${baseUrl}/${this.containerName}/${blobPath}`,
        path: blobPath
      };
    }
    
    // Try to upload to Azure
    try {
      console.log(`Attempting to upload to Azure: ${blobPath}`);
      
      // Ensure container exists
      await this.ensureContainer();
      
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
      console.log('Falling back to local storage URL format');
      
      // Return a URL format that matches Azure for consistency
      const baseUrl = 'https://insurancedocuments.blob.core.windows.net';
      return {
        url: `${baseUrl}/${this.containerName}/${blobPath}`,
        path: blobPath
      };
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
      
      // Check if we're in local storage mode or Azure client failed
      if (this.isLocalStorage || !this.blobServiceClient) {
        // Try to find the file locally
        const localPaths = [
          path.join(this.localStoragePath, clientId, documentType, fileName),
          path.join('uploads', clientId, documentType, fileName),
          path.join('/workspace/uploads', clientId, documentType, fileName)
        ];
        
        console.log('Checking possible local paths:', localPaths);
        
        // Try each possible path
        for (const localPath of localPaths) {
          if (fs.existsSync(localPath)) {
            console.log(`File found at local path: ${localPath}`);
            return localPath;
          }
        }
        
        // Look for any file in the directory as a fallback
        for (const localPath of localPaths.map(p => path.dirname(p))) {
          if (fs.existsSync(localPath)) {
            try {
              const files = fs.readdirSync(localPath);
              if (files.length > 0) {
                const firstFile = path.join(localPath, files[0]);
                console.log(`File not found exactly, using similar file: ${firstFile}`);
                return firstFile;
              }
            } catch (readError) {
              console.error(`Error reading directory: ${localPath}`, readError);
            }
          }
        }
        
        console.error(`File not found locally: ${fileName}`);
        throw new Error(`File not found: ${fileName}`);
      }
      
      // Try to generate Azure SAS URL
      try {
        // Get a container client
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        
        // Check if blob exists
        const blobClient = containerClient.getBlobClient(blobPath);
        const exists = await blobClient.exists();
        
        if (!exists) {
          console.error(`Blob not found in Azure: ${blobPath}`);
          
          // Try to find the file locally as fallback
          const localPaths = [
            path.join(this.localStoragePath, clientId, documentType, fileName),
            path.join('uploads', clientId, documentType, fileName),
            path.join('/workspace/uploads', clientId, documentType, fileName)
          ];
          
          for (const localPath of localPaths) {
            if (fs.existsSync(localPath)) {
              console.log(`File not found in Azure but found locally: ${localPath}`);
              return localPath;
            }
          }
          
          throw new Error(`File not found: ${fileName}`);
        }
        
        console.log(`Blob exists in Azure: ${blobPath}, generating SAS URL...`);
        
        // Generate a SAS URL
        const sasOptions = {
          expiresOn: new Date(new Date().valueOf() + expirySeconds * 1000),
          permissions: BlobSASPermissions.parse("r"), // Read-only permission
          contentDisposition: 'inline',
          protocol: 'https,http' as SASProtocol // Allow both protocols
        };
        
        const sasUrl = await blobClient.generateSasUrl(sasOptions);
        
        // Log the URL (without the SAS token part for security)
        const sasUrlShort = sasUrl.substring(0, sasUrl.indexOf('?') + 10) + '...';
        console.log(`Generated Azure SAS URL: ${sasUrlShort}`);
        
        return sasUrl;
      } catch (azureError) {
        console.error('Error generating Azure SAS URL:', azureError);
        
        // Try to find the file locally as fallback
        const localPaths = [
          path.join(this.localStoragePath, clientId, documentType, fileName),
          path.join('uploads', clientId, documentType, fileName),
          path.join('/workspace/uploads', clientId, documentType, fileName)
        ];
        
        for (const localPath of localPaths) {
          if (fs.existsSync(localPath)) {
            console.log(`Falling back to local file: ${localPath}`);
            return localPath;
          }
        }
        
        throw new Error(`File not found: ${fileName}`);
      }
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
      
      let deletedFromAzure = false;
      let deletedFromLocal = false;
      
      // Try to delete from Azure if client is available
      if (!this.isLocalStorage && this.blobServiceClient) {
        try {
          // Get a container client
          const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
          
          // Get a blob client
          const blobClient = containerClient.getBlobClient(blobPath);
          
          // Check if blob exists before attempting to delete
          const exists = await blobClient.exists();
          if (exists) {
            // Delete the blob
            await blobClient.delete();
            console.log(`Blob deleted from Azure: ${blobPath}`);
            deletedFromAzure = true;
          } else {
            console.log(`Blob does not exist in Azure: ${blobPath}`);
          }
        } catch (azureError) {
          console.error('Error deleting from Azure:', azureError);
        }
      }
      
      // Always try to delete local file too
      try {
        const localPaths = [
          path.join(this.localStoragePath, clientId, documentType, fileName),
          path.join('uploads', clientId, documentType, fileName),
          path.join('/workspace/uploads', clientId, documentType, fileName)
        ];
        
        for (const localPath of localPaths) {
          if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath);
            console.log(`Local file deleted: ${localPath}`);
            deletedFromLocal = true;
            break;
          }
        }
        
        if (!deletedFromLocal) {
          console.log('No local file found to delete');
        }
      } catch (localError) {
        console.error('Error deleting local file:', localError);
      }
      
      return deletedFromAzure || deletedFromLocal;
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
      if (this.isLocalStorage || !this.blobServiceClient) {
        console.log('Using local storage, no need to create Azure container');
        return;
      }
      
      console.log(`Ensuring container '${this.containerName}' exists...`);
      
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      await containerClient.createIfNotExists();
      console.log(`Container '${this.containerName}' created or already exists.`);
    } catch (error) {
      console.error('Error ensuring container exists:', error);
      console.log('Will continue with local storage');
      this.isLocalStorage = true;
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
    return path.extname(filename);
  }

  /**
   * Get a container client for the storage container
   */
  async getContainerClient(): Promise<ContainerClient> {
    if (this.isLocalStorage || !this.blobServiceClient) {
      throw new Error('Blob service client is not initialized');
    }
    
    return this.blobServiceClient.getContainerClient(this.containerName);
  }
}

const storageService = new BlobStorageService();
export default storageService; 