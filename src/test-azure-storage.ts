import { BlobServiceClient } from '@azure/storage-blob';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

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
  
  // Log masked connection string for debugging
  const maskedConnectionString = connectionString.substring(0, 30) + '...' + connectionString.substring(connectionString.length - 10);
  console.log(`Connection string (masked): ${maskedConnectionString}`);
  console.log(`Container name: ${containerName}`);
  
  try {
    // Create the BlobServiceClient
    console.log('Creating BlobServiceClient...');
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    console.log('✓ Successfully created BlobServiceClient');
    
    // Get container client
    console.log(`Getting container client for "${containerName}"...`);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    console.log(`✓ Got container client for "${containerName}"`);
    
    // Check if container exists, create if it doesn't
    console.log('Checking if container exists...');
    const containerExists = await containerClient.exists();
    if (!containerExists) {
      console.log(`Container "${containerName}" does not exist, creating...`);
      await containerClient.create();
      console.log(`✓ Created container "${containerName}"`);
    } else {
      console.log(`✓ Container "${containerName}" already exists`);
    }

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
    const testFileName = `test-file-${Date.now()}.txt`;
    const testContent = Buffer.from('This is a test file to verify Azure Blob Storage is working correctly.');
    const blockBlobClient = containerClient.getBlockBlobClient(testFileName);
    
    console.log(`Uploading test file "${testFileName}"...`);
    await blockBlobClient.upload(testContent, testContent.length);
    console.log(`✓ Successfully uploaded test file: ${blockBlobClient.url}`);
    
    // Download the test file to verify
    console.log('Downloading test file to verify...');
    const downloadResponse = await blockBlobClient.download(0);
    const downloadedContent = await streamToBuffer(downloadResponse.readableStreamBody!);
    console.log(`✓ Successfully downloaded test file (${downloadedContent.length} bytes)`);
    
    // Verify content
    if (downloadedContent.toString() === testContent.toString()) {
      console.log('✓ Downloaded content matches uploaded content');
    } else {
      console.error('✗ Downloaded content does not match uploaded content');
    }
    
    // Delete the test file
    console.log('Deleting test file...');
    await blockBlobClient.delete();
    console.log(`✓ Successfully deleted test file`);
    
    console.log('\n✅ Azure Blob Storage connection test PASSED');
    console.log('Your Azure Blob Storage is correctly configured and working!');
    
  } catch (error) {
    console.error('\n❌ Azure Blob Storage connection test FAILED');
    console.error('Error details:', error);
    console.error('\nPossible issues:');
    console.error('1. Invalid connection string');
    console.error('2. Network connectivity issues');
    console.error('3. Insufficient permissions');
    console.error('4. Account or container does not exist');
  }
}

// Helper function to convert a readable stream to a buffer
async function streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}

// Run the test
testAzureStorage().catch(console.error); 