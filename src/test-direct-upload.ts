import dotenv from 'dotenv';
import { BlobStorageService } from './services/storage';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Create an instance of the storage service
const storageService = new BlobStorageService();

async function testDirectUpload() {
  console.log('Testing direct file upload to Azure Blob Storage...');
  
  try {
    // Create a test file with random content to measure upload speed
    const testSizeMB = 2; // 2MB test file
    const testBuffer = Buffer.alloc(testSizeMB * 1024 * 1024);
    
    // Fill with random data
    for (let i = 0; i < testBuffer.length; i += 4) {
      testBuffer.writeUInt32LE(Math.floor(Math.random() * 0xFFFFFFFF), i);
    }
    
    const testFileName = `test-direct-upload-${Date.now()}.bin`;
    const clientId = 'test-client';
    const documentType = 'test-doc';
    
    console.log(`Uploading ${testSizeMB}MB test file "${testFileName}" to Azure...`);
    
    // Measure upload time
    const startTime = Date.now();
    
    // Use the storage service to upload the file
    const result = await storageService.uploadFile(
      clientId,
      documentType,
      testFileName,
      testBuffer,
      'application/octet-stream'
    );
    
    const endTime = Date.now();
    const uploadTime = (endTime - startTime) / 1000; // seconds
    const uploadSpeed = testSizeMB / uploadTime; // MB/s
    
    console.log('Upload result:', result);
    console.log(`File URL: ${result.url}`);
    console.log(`File path: ${result.path}`);
    console.log(`Upload time: ${uploadTime.toFixed(2)} seconds`);
    console.log(`Upload speed: ${uploadSpeed.toFixed(2)} MB/s`);
    
    // Verify the file exists in Azure by generating a secure URL
    console.log('\nGenerating secure URL to verify file exists...');
    const secureUrl = await storageService.generateSecureUrl(
      clientId,
      documentType,
      testFileName
    );
    
    console.log(`Secure URL: ${secureUrl}`);
    console.log('Test completed successfully!');
    
    // Check if the file was saved locally (it shouldn't be with our changes)
    const localPath = path.join('./uploads', clientId, documentType, testFileName);
    const localExists = fs.existsSync(localPath);
    
    console.log(`\nChecking if file was saved locally: ${localExists ? 'YES (unexpected)' : 'NO (expected)'}`);
    
    if (localExists) {
      console.warn('WARNING: File was saved locally even though direct upload was intended');
    } else {
      console.log('SUCCESS: File was not saved locally as expected');
    }
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the test
testDirectUpload().catch(console.error); 