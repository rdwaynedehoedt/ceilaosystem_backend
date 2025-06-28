import dotenv from 'dotenv';
import { BlobServiceClient } from '@azure/storage-blob';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

async function listBlobs() {
  try {
    // Get connection string from environment variable
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    
    if (!connectionString) {
      console.error('Error: AZURE_STORAGE_CONNECTION_STRING is not defined in the environment');
      process.exit(1);
    }
    
    console.log('Connecting to Azure Blob Storage...');
    
    // Create BlobServiceClient
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    console.log('Connected to Azure Blob Storage');
    
    // Get container name from environment or use default
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'insurance-docs';
    
    // Get container client
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Check if container exists
    const containerExists = await containerClient.exists();
    
    if (!containerExists) {
      console.log(`Container '${containerName}' does not exist. Creating it...`);
      await containerClient.create();
      console.log(`Container '${containerName}' created successfully.`);
    } else {
      console.log(`Container '${containerName}' exists.`);
    }
    
    // List all blobs in the container
    console.log(`\nListing blobs in container '${containerName}':`);
    
    let blobCount = 0;
    const blobsIter = containerClient.listBlobsFlat();
    
    console.log('\nBlobs:');
    for await (const blob of blobsIter) {
      console.log(`- ${blob.name} (${blob.properties.contentLength} bytes, Last Modified: ${blob.properties.lastModified})`);
      blobCount++;
    }
    
    if (blobCount === 0) {
      console.log('No blobs found in the container.');
    } else {
      console.log(`\nTotal blobs: ${blobCount}`);
    }
    
    // Now check local uploads directory for files
    console.log('\nChecking local uploads directory...');
    
    const localDirs = [
      './uploads',
      '../uploads',
      '../../uploads',
      'uploads'
    ];
    
    let foundLocalFiles = false;
    
    for (const dir of localDirs) {
      try {
        if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
          console.log(`Found local uploads directory at: ${path.resolve(dir)}`);
          foundLocalFiles = await listFilesRecursively(dir);
        }
      } catch (error: any) {
        console.error(`Error checking directory ${dir}:`, error);
      }
    }
    
    if (!foundLocalFiles) {
      console.log('No local files found in any uploads directory.');
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

async function listFilesRecursively(dirPath: string): Promise<boolean> {
  try {
    const entries = fs.readdirSync(dirPath);
    
    if (entries.length === 0) {
      console.log(`  Directory is empty: ${dirPath}`);
      return false;
    }
    
    let foundFiles = false;
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        console.log(`  Directory: ${fullPath}`);
        const foundInSubdir = await listFilesRecursively(fullPath);
        if (foundInSubdir) foundFiles = true;
      } else {
        console.log(`  File: ${fullPath} (${formatSize(stats.size)})`);
        foundFiles = true;
      }
    }
    
    return foundFiles;
  } catch (error) {
    console.error(`Error listing files in ${dirPath}:`, error);
    return false;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

// Run the list blobs function
listBlobs().then(() => {
  console.log('Done!');
}).catch(err => {
  console.error('Error in main function:', err);
}); 