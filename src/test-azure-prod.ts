import dotenv from 'dotenv';
import { BlobServiceClient } from '@azure/storage-blob';

dotenv.config();

async function testAzureConnection() {
  console.log('Testing Azure Blob Storage connection in production...');
  
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'customer-documents';
  
  if (!connectionString) {
    console.error('ERROR: AZURE_STORAGE_CONNECTION_STRING not set in environment');
    return;
  }
  
  // Log masked connection string for debugging
  const maskedConnectionString = connectionString.substring(0, 30) + '...' + connectionString.substring(connectionString.length - 10);
  console.log(`Connection string (masked): ${maskedConnectionString}`);
  console.log(`Container name: ${containerName}`);
  
  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    console.log('Successfully created BlobServiceClient');
    
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const exists = await containerClient.exists();
    
    if (exists) {
      console.log(`Container "${containerName}" exists`);
      
      // List some blobs to verify access
      console.log('Listing blobs in container...');
      let i = 0;
      const blobs = containerClient.listBlobsFlat();
      for await (const blob of blobs) {
        console.log(`  - ${blob.name}`);
        if (++i >= 5) {
          console.log('  ... (more blobs exist)');
          break;
        }
      }
      
      if (i === 0) {
        console.log('  No blobs found in container');
      }
      
      // Upload a test file
      const testFileName = `test-prod-${Date.now()}.txt`;
      const testContent = Buffer.from('This is a test file from production environment.');
      const blockBlobClient = containerClient.getBlockBlobClient(testFileName);
      
      console.log(`Uploading test file "${testFileName}"...`);
      await blockBlobClient.upload(testContent, testContent.length);
      console.log(`Successfully uploaded test file: ${blockBlobClient.url}`);
      
      // Delete the test file
      console.log('Deleting test file...');
      await blockBlobClient.delete();
      console.log(`Successfully deleted test file`);
      
    } else {
      console.log(`Container "${containerName}" does not exist`);
      
      // Try to create the container
      console.log(`Attempting to create container "${containerName}"...`);
      await containerClient.create();
      console.log(`Successfully created container "${containerName}"`);
    }
    
    console.log('Azure Blob Storage connection test successful');
  } catch (error) {
    console.error('Azure Blob Storage connection test failed:', error);
  }
}

testAzureConnection().catch(console.error); 