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

// Singleton instance for connection pooling
let blobServiceClientInstance: BlobServiceClient | null = null;

export class BlobStorageService {
  private containerName: string = process.env.AZURE_STORAGE_CONTAINER_NAME || 'customer-documents';
  private connectionString: string = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
  private blobServiceClient: BlobServiceClient | null = null;
  
  // Connection pooling configuration
  private static connectionOptions = {
    keepAliveOptions: {
      enable: true,
      initialDelay: 5000, // 5 seconds
      keepAliveTime: 30000 // 30 seconds
    },
    retryOptions: {
      maxTries: 4,
      tryTimeoutInMs: 60000, // 60 seconds
      retryDelayInMs: 1000 // 1 second
    }
  };

  constructor() {
    console.log('Initializing BlobStorageService...');
    
    if (!this.connectionString || this.connectionString.trim() === '') {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING environment variable is required');
    }
    
    try {
      console.log('Initializing Azure Blob Storage client...');
      
      // Use singleton pattern for connection pooling
      if (!blobServiceClientInstance) {
        // Create the BlobServiceClient from connection string with optimized options
        blobServiceClientInstance = BlobServiceClient.fromConnectionString(
          this.connectionString,
          BlobStorageService.connectionOptions
        );
        console.log('Created new Azure Blob Storage client instance');
    } else {
        console.log('Reusing existing Azure Blob Storage client instance');
      }
      
      this.blobServiceClient = blobServiceClientInstance;
        console.log('Azure Blob Storage client initialized successfully');
      
      // Test the connection immediately to verify it works
      this.testConnection();
      } catch (error) {
      console.error('CRITICAL ERROR: Failed to initialize Azure Blob Storage client:', error);
      throw new Error('Failed to initialize Azure Blob Storage client. Check your connection string.');
    }
  }

  /**
   * Test the Azure Blob Storage connection
   */
  private async testConnection(): Promise<void> {
    try {
      if (!this.blobServiceClient) {
        throw new Error('Blob service client is not initialized');
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
      throw new Error('Failed to connect to Azure Blob Storage');
    }
  }

  /**
   * Upload a file directly to Azure Blob Storage with optimized parallel uploads
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
      
    if (!this.blobServiceClient) {
      throw new Error('Azure Blob Storage client is not initialized');
        }
        
    // Upload directly to Azure
    try {
      console.log(`Uploading directly to Azure: ${blobPath}`);
      
        // Ensure container exists
        await this.ensureContainer();

        // Get a container client
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        
        // Get a block blob client
        const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
        
      // Determine if we should use parallel uploads based on file size
      const useParallelUpload = fileContent.length > 1024 * 1024; // > 1MB
      const concurrency = this.calculateConcurrency(fileContent.length);
      
      // Set upload options with optimized parameters
      const uploadOptions = {
          blobHTTPHeaders: {
            blobContentType: contentType
        },
        // Use parallel upload for larger files with dynamic concurrency
        concurrency: concurrency,
        maxSingleShotSize: 4 * 1024 * 1024, // 4MB
        onProgress: (progress: { loadedBytes: number }) => {
          if (progress.loadedBytes % (1024 * 1024) === 0 || progress.loadedBytes === fileContent.length) {
            console.log(`Upload progress for ${blobPath}: ${Math.round(progress.loadedBytes / fileContent.length * 100)}%`);
          }
        }
      };
      
      console.log(`Using ${useParallelUpload ? 'parallel' : 'single'} upload with concurrency ${concurrency}`);
      
      // Start upload timer
      const startTime = Date.now();
      
      // Upload the file
      await blockBlobClient.upload(fileContent, fileContent.length, uploadOptions);
      
      // Calculate upload speed
      const endTime = Date.now();
      const uploadTimeSeconds = (endTime - startTime) / 1000;
      const uploadSpeedMBps = (fileContent.length / (1024 * 1024)) / uploadTimeSeconds;
        
        console.log(`File uploaded successfully to Azure: ${blobPath}`);
      console.log(`Upload time: ${uploadTimeSeconds.toFixed(2)}s, Speed: ${uploadSpeedMBps.toFixed(2)} MB/s`);
        
      // Return the blob URL and path
        return {
          url: blockBlobClient.url,
          path: blobPath
        };
    } catch (error: any) {
      console.error('Error uploading file to Azure:', error);
      throw new Error(`Failed to upload file to Azure: ${error.message}`);
    }
  }

  /**
   * Calculate optimal concurrency based on file size
   */
  private calculateConcurrency(fileSize: number): number {
    if (fileSize < 1024 * 1024) {
      // Less than 1MB
      return 1;
    } else if (fileSize < 5 * 1024 * 1024) {
      // 1-5MB
      return 2;
    } else if (fileSize < 20 * 1024 * 1024) {
      // 5-20MB
      return 4;
    } else if (fileSize < 50 * 1024 * 1024) {
      // 20-50MB
      return 8;
    } else {
      // > 50MB
      return 16;
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
        throw new Error('Azure Blob Storage client is not initialized');
        }
        
        // Get a container client
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        
        // Check if blob exists
        const blobClient = containerClient.getBlobClient(blobPath);
        const exists = await blobClient.exists();
        
        if (!exists) {
        console.error(`Blob not found in Azure: ${blobPath}`);
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
    } catch (error: any) {
      console.error('Error generating secure URL:', error);
      throw new Error(`Failed to generate secure URL: ${error.message}`);
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
        throw new Error('Azure Blob Storage client is not initialized');
        }
        
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
        return true;
      } else {
        console.log(`Blob does not exist in Azure: ${blobPath}`);
        return false;
      }
    } catch (error: any) {
      console.error('Error deleting file:', error);
      throw new Error(`Failed to delete file from Azure: ${error.message}`);
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
      
      console.log(`Ensuring container '${this.containerName}' exists...`);
      
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      await containerClient.createIfNotExists();
      console.log(`Container '${this.containerName}' created or already exists.`);
    } catch (error) {
      console.error('Error ensuring container exists:', error);
      throw new Error('Failed to ensure storage container exists');
    }
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

  /**
   * Generate a SAS token for direct upload to Azure Blob Storage
   * @param clientId The client ID to associate with the file
   * @param documentType The type of document (e.g., 'nic', 'dob_proof', etc.)
   * @param fileName Optional filename, will generate a UUID if not provided
   * @param expiryMinutes How many minutes the token should be valid
   * @returns Object containing the SAS URL, token, and blob details
   */
  async generateUploadSasToken(
    clientId: string,
    documentType: string,
    fileName?: string,
    expiryMinutes: number = 15
  ): Promise<{
    sasUrl: string,
    sasToken: string,
    blobUrl: string,
    blobName: string,
    containerName: string
  }> {
    try {
      if (!this.blobServiceClient) {
        throw new Error('Blob service client is not initialized');
      }
      
      // Ensure container exists
      await this.ensureContainer();
      
      // Generate a unique name for the file if not provided
      const actualFileName = fileName || `${uuidv4()}${fileName ? path.extname(fileName) : ''}`;
      
      // Create the blob path
      const blobName = `${clientId}/${documentType}/${actualFileName}`;
      
      // Get the container client
      const containerClient = await this.getContainerClient();
      
      // Get credentials from connection string
      const accountName = this.connectionString.match(/AccountName=([^;]+)/i)?.[1];
      const accountKey = this.connectionString.match(/AccountKey=([^;]+)/i)?.[1];
      
      if (!accountName || !accountKey) {
        throw new Error('Could not extract account credentials from connection string');
      }
      
      const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
      
      // Create SAS token with write permissions
      const sasOptions = {
        containerName: this.containerName,
        blobName: blobName,
        permissions: BlobSASPermissions.parse('cw'), // Create and Write permissions
        startsOn: new Date(),
        expiresOn: new Date(new Date().valueOf() + expiryMinutes * 60 * 1000),
        protocol: SASProtocol.Https
      };
      
      // Generate the SAS token
      const sasToken = generateBlobSASQueryParameters(
        sasOptions,
        sharedKeyCredential
      ).toString();
      
      // Get the blob client to get the URL
      const blobClient = containerClient.getBlobClient(blobName);
      const blobUrl = blobClient.url;
      
      // Construct the full SAS URL
      const sasUrl = `${blobUrl}?${sasToken}`;
      
      return {
        sasUrl,
        sasToken,
        blobUrl,
        blobName,
        containerName: this.containerName
      };
    } catch (error) {
      console.error('Error generating upload SAS token:', error);
      throw error;
    }
  }
}

const storageService = new BlobStorageService();
export default storageService; 