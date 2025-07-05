import storageService from './services/storage';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testUpload() {
  console.log('Testing file upload to Azure Blob Storage...');
  
  try {
    // Create a test file
    const testContent = 'This is a test file for Azure Blob Storage upload.';
    const testBuffer = Buffer.from(testContent);
    const testFileName = `test-upload-${Date.now()}.txt`;
    const clientId = 'test-client';
    const documentType = 'test-doc';
    
    console.log(`Uploading test file "${testFileName}" to Azure...`);
    
    // Use the storage service to upload the file
    const result = await storageService.uploadFile(
      clientId,
      documentType,
      testFileName,
      testBuffer,
      'text/plain'
    );
    
    console.log('Upload result:', result);
    console.log(`File URL: ${result.url}`);
    console.log(`File path: ${result.path}`);
    
    // Verify the file exists in Azure by generating a secure URL
    console.log('\nGenerating secure URL to verify file exists...');
    try {
      const secureUrl = await storageService.generateSecureUrl(
        clientId,
        documentType,
        testFileName
      );
      
      console.log(`Secure URL generated: ${secureUrl.substring(0, secureUrl.indexOf('?') + 10)}...`);
      
      // Try to download the file to verify it exists
      console.log('\nDownloading file to verify it exists...');
      const response = await fetch(secureUrl);
      
      if (response.ok) {
        const downloadedContent = await response.text();
        console.log('Downloaded content:', downloadedContent);
        
        if (downloadedContent === testContent) {
          console.log('✅ SUCCESS: Downloaded content matches uploaded content');
        } else {
          console.log('❌ ERROR: Downloaded content does not match uploaded content');
        }
      } else {
        console.log(`❌ ERROR: Failed to download file: ${response.status} ${response.statusText}`);
      }
    } catch (secureUrlError) {
      console.error('Error generating secure URL:', secureUrlError);
    }
    
    // Check if the file was saved locally as well
    console.log('\nChecking if file was saved locally...');
    const localPaths = [
      path.join('./uploads', clientId, documentType, testFileName),
      path.join('uploads', clientId, documentType, testFileName),
      path.join(process.cwd(), 'uploads', clientId, documentType, testFileName)
    ];
    
    let foundLocally = false;
    for (const localPath of localPaths) {
      if (fs.existsSync(localPath)) {
        console.log(`File found locally at: ${localPath}`);
        const localContent = fs.readFileSync(localPath, 'utf8');
        console.log('Local file content:', localContent);
        foundLocally = true;
        break;
      }
    }
    
    if (!foundLocally) {
      console.log('File not found locally');
    }
    
    // Clean up - delete the test file
    console.log('\nCleaning up - deleting test file...');
    const deleteResult = await storageService.deleteFile(clientId, documentType, testFileName);
    console.log('Delete result:', deleteResult);
    
    console.log('\nTest completed!');
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testUpload().catch(console.error); 