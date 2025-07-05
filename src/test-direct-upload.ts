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
    console.log(`Uploading ${testSizeMB}MB test file "${testFileName}" to Azure...`);
    
    // Measure upload time
    const startTime = Date.now();
    
    // Upload the file to Azure
    const uploadResult = await storageService.uploadFile(
      'test-client',
      'test-doc',
      testFileName,
      testBuffer,
      'application/octet-stream'
    );
    
    // Calculate upload time and speed
    const endTime = Date.now();
    const uploadTimeSeconds = (endTime - startTime) / 1000;
    const uploadSpeedMBps = testSizeMB / uploadTimeSeconds;
    
    console.log('Upload result:', uploadResult);
    console.log('File URL:', uploadResult.url);
    console.log('File path:', uploadResult.path);
    console.log(`Upload time: ${uploadTimeSeconds.toFixed(2)} seconds`);
    console.log(`Upload speed: ${uploadSpeedMBps.toFixed(2)} MB/s`);
    
    // Verify the file exists in Azure by generating a secure URL
    console.log('\nGenerating secure URL to verify file exists...');
    const secureUrl = await storageService.generateSecureUrl(
      'test-client',
      'test-doc',
      testFileName
    );
    
    console.log('Secure URL:', secureUrl);
    console.log('Test completed successfully!');
    
    // Check if file was saved locally (should not be)
    const localPath = path.join('./uploads', 'test-client', 'test-doc', testFileName);
    const fileExistsLocally = fs.existsSync(localPath);
    
    console.log(`\nChecking if file was saved locally: ${fileExistsLocally ? 'YES (unexpected!)' : 'NO (expected)'}`);
    
    if (fileExistsLocally) {
      console.error('ERROR: File was saved locally even though local storage should be disabled!');
      process.exit(1);
    } else {
      console.log('SUCCESS: File was not saved locally as expected');
    }
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testDirectUpload(); 