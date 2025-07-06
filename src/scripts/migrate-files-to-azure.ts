import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { BlobServiceClient } from '@azure/storage-blob';
import { BlobStorageService } from '../services/storage';

// Load environment variables
dotenv.config();

/**
 * Migrate files from local storage to Azure Blob Storage
 */
async function migrateFilesToAzure() {
  console.log('Starting migration of local files to Azure Blob Storage...');
  
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'customer-documents';
  
  if (!connectionString) {
    console.error('ERROR: AZURE_STORAGE_CONNECTION_STRING not set in environment');
    return;
  }
  
  const localStoragePath = './uploads';
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
    const clientFolders = fs.readdirSync(localStoragePath);
    console.log(`Found ${clientFolders.length} client folders in local storage`);
    
    let totalFiles = 0;
    let migratedFiles = 0;
    let failedFiles = 0;
    
    // Process each client folder
    for (const clientId of clientFolders) {
      const clientPath = path.join(localStoragePath, clientId);
      
      // Skip if not a directory
      if (!fs.statSync(clientPath).isDirectory()) {
        continue;
      }
      
      console.log(`Processing client folder: ${clientId}`);
      
      // Get all document type folders for this client
      const documentTypeFolders = fs.readdirSync(clientPath);
      
      // Process each document type folder
      for (const documentType of documentTypeFolders) {
        const documentTypePath = path.join(clientPath, documentType);
        
        // Skip if not a directory
        if (!fs.statSync(documentTypePath).isDirectory()) {
          continue;
        }
        
        console.log(`  Processing document type: ${documentType}`);
        
        // Get all files in this document type folder
        const files = fs.readdirSync(documentTypePath);
        totalFiles += files.length;
        
        console.log(`    Found ${files.length} files to migrate`);
        
        // Process each file
        for (const fileName of files) {
          const filePath = path.join(documentTypePath, fileName);
          
          // Skip if not a file
          if (!fs.statSync(filePath).isFile()) {
            continue;
          }
          
          try {
            console.log(`    Migrating file: ${fileName}`);
            
            // Read the file content
            const fileContent = fs.readFileSync(filePath);
            
            // Determine content type based on file extension
            const ext = path.extname(fileName).toLowerCase();
            let contentType = 'application/octet-stream'; // Default
            if (ext === '.pdf') contentType = 'application/pdf';
            else if (ext === '.png') contentType = 'image/png';
            else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
            else if (ext === '.gif') contentType = 'image/gif';
            
            // Upload to Azure Blob Storage
            const blobPath = `${clientId}/${documentType}/${fileName}`;
            const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
            
            await blockBlobClient.upload(fileContent, fileContent.length, {
              blobHTTPHeaders: {
                blobContentType: contentType
              }
            });
            
            console.log(`    ✓ Successfully uploaded to Azure: ${blockBlobClient.url}`);
            migratedFiles++;
            
            // Optionally, rename the local file to mark it as migrated
            // fs.renameSync(filePath, `${filePath}.migrated`);
          } catch (error) {
            console.error(`    ✗ Failed to migrate file ${fileName}:`, error);
            failedFiles++;
          }
        }
      }
    }
    
    console.log('\nMigration summary:');
    console.log(`Total files found: ${totalFiles}`);
    console.log(`Successfully migrated: ${migratedFiles}`);
    console.log(`Failed to migrate: ${failedFiles}`);
    
    if (migratedFiles === totalFiles) {
      console.log('\n✅ All files successfully migrated to Azure Blob Storage!');
    } else {
      console.log('\n⚠️ Some files could not be migrated. Check the logs for details.');
    }
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// Run the migration
migrateFilesToAzure().catch(console.error); 