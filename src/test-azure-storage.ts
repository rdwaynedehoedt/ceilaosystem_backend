import { BlobServiceClient, PublicAccessType } from '@azure/storage-blob';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

async function testAzureStorage() {
  console.log('Testing Azure Blob Storage connection...');
  
  // Get connection string from environment
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'customer-documents';
  
  if (!connectionString) {
    console.error('Error: AZURE_STORAGE_CONNECTION_STRING not found in environment variables');
    return;
  }
  
  try {
    // Create the BlobServiceClient
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    console.log('✓ Successfully created BlobServiceClient');
    
    // Get container client
    const containerClient = blobServiceClient.getContainerClient(containerName);
    console.log(`✓ Got container client for "${containerName}"`);
    
    // Check if container exists, create if it doesn't
    const containerExists = await containerClient.exists();
    if (!containerExists) {
      console.log(`Container "${containerName}" does not exist, creating...`);
      await containerClient.create();
      console.log(`✓ Created container "${containerName}"`);
    } else {
      console.log(`✓ Container "${containerName}" already exists`);
    }

    // Set container access level to allow anonymous read access
    console.log('Setting container access level to allow anonymous blob read access...');
    await containerClient.setAccessPolicy("blob"); // "blob" for anonymous read access to blobs only
    console.log('✓ Container access level set to "blob" (anonymous read access)');
    
    // Upload a test file
    const testFileName = `test-file-${Date.now()}.txt`;
    const testContent = Buffer.from('This is a test file to verify Azure Blob Storage is working correctly.');
    const blockBlobClient = containerClient.getBlockBlobClient(testFileName);
    
    console.log(`Uploading test file "${testFileName}"...`);
    await blockBlobClient.upload(testContent, testContent.length);
    console.log(`✓ Successfully uploaded test file to ${blockBlobClient.url}`);
    
    // List some blobs in the container
    console.log('Listing up to 10 blobs in container:');
    let i = 0;
    for await (const blob of containerClient.listBlobsFlat()) {
      console.log(`- ${blob.name} (${new Date(blob.properties.createdOn || 0).toLocaleString()})`);
      i++;
      if (i >= 10) break;
    }
    
    // Clean up the test file
    console.log(`Deleting test file "${testFileName}"...`);
    await blockBlobClient.delete();
    console.log('✓ Successfully deleted test file');
    
    console.log('\nAzure Blob Storage connection test completed successfully! ✓');
    console.log('You can now access blobs directly with anonymous read access.');
    console.log('Direct URL format: https://{accountName}.blob.core.windows.net/{containerName}/{blobPath}');
  } catch (error) {
    console.error('Error testing Azure Blob Storage connection:', error);
  }
}

// Run the test
testAzureStorage().catch(console.error); 