import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { BlobServiceClient } from '@azure/storage-blob';
import { promisify } from 'util';
import { BlobStorageService } from './services/storage';

// Load environment variables
dotenv.config();

// Create an instance of the storage service
const storageService = new BlobStorageService();

// Convert fs functions to promises
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);

// Local storage path
const localStoragePath = './uploads';

/**
 * Migrate files from local storage to Azure Blob Storage
 */
async function migrateLocalFilesToAzure() {
  console.log('Starting migration of local files to Azure Blob Storage...');
  
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'customer-documents';
  
  if (!connectionString) {
    console.error('ERROR: AZURE_STORAGE_CONNECTION_STRING not set in environment');
    return;
  }
  
  if (!fs.existsSync(localStoragePath)) {
    console.error(`ERROR: Local storage directory "${localStoragePath}" does not exist`);
    return;
  }
  
  try {
    // Initialize Azure Blob Storage client
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    console.log('Successfully created BlobServiceClient');
    
    // Get container client
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const exists = await containerClient.exists();
    
    if (!exists) {
      console.log(`Container "${containerName}" does not exist, creating...`);
      await containerClient.create();
      console.log(`Successfully created container "${containerName}"`);
    }
    
    // Get all client folders
    const clientFolders = await readdir(localStoragePath);
    console.log(`Found ${clientFolders.length} client folders in local storage`);
    
    let totalFiles = 0;
    let migratedFiles = 0;
    let failedFiles = 0;
    let skippedFiles = 0;
    
    // Process each client folder
    for (const clientId of clientFolders) {
      const clientPath = path.join(localStoragePath, clientId);
      const clientStat = await stat(clientPath);
      
      if (!clientStat.isDirectory()) {
        console.log(`Skipping non-directory: ${clientPath}`);
        continue;
      }
      
      console.log(`\nProcessing client folder: ${clientId}`);
      
      // Get document type folders for this client
      const documentTypeFolders = await readdir(clientPath);
      
      // Process each document type folder
      for (const documentType of documentTypeFolders) {
        const documentTypePath = path.join(clientPath, documentType);
        const documentTypeStat = await stat(documentTypePath);
        
        if (!documentTypeStat.isDirectory()) {
          console.log(`Skipping non-directory: ${documentTypePath}`);
          continue;
        }
        
        console.log(`Processing document type: ${documentType}`);
        
        // Get all files in this document type folder
        const files = await readdir(documentTypePath);
        totalFiles += files.length;
        
        // Process each file
        for (const fileName of files) {
          const filePath = path.join(documentTypePath, fileName);
          const fileStat = await stat(filePath);
          
          if (!fileStat.isFile()) {
            console.log(`Skipping non-file: ${filePath}`);
            continue;
          }
          
          const blobPath = `${clientId}/${documentType}/${fileName}`;
          console.log(`Processing file: ${blobPath}`);
          
          try {
            // Check if file already exists in Azure
            const blobClient = containerClient.getBlobClient(blobPath);
            const blobExists = await blobClient.exists();
            
            if (blobExists) {
              console.log(`File already exists in Azure, skipping: ${blobPath}`);
              skippedFiles++;
              continue;
            }
            
            // Read file content
            const fileContent = await readFile(filePath);
            
            // Determine content type based on file extension
            const ext = path.extname(fileName).toLowerCase();
            let contentType = 'application/octet-stream'; // Default
            
            if (ext === '.pdf') contentType = 'application/pdf';
            else if (ext === '.png') contentType = 'image/png';
            else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
            else if (ext === '.gif') contentType = 'image/gif';
            
            // Upload to Azure
            console.log(`Uploading ${fileContent.length} bytes to Azure: ${blobPath}`);
            
            // Use the storage service to upload the file
            const result = await storageService.uploadFile(
              clientId,
              documentType,
              fileName,
              fileContent,
              contentType
            );
            
            console.log(`Successfully migrated file to Azure: ${blobPath}`);
            console.log(`Azure URL: ${result.url}`);
            migratedFiles++;
            
          } catch (error) {
            console.error(`Error migrating file ${blobPath}:`, error);
            failedFiles++;
          }
        }
      }
    }
    
    console.log('\nMigration completed!');
    console.log(`Total files found: ${totalFiles}`);
    console.log(`Files migrated: ${migratedFiles}`);
    console.log(`Files skipped (already exist): ${skippedFiles}`);
    console.log(`Files failed: ${failedFiles}`);
    
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// Run the migration
migrateLocalFilesToAzure().catch(console.error); 