import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { BlobStorageService } from './services/storage';
import { ImageOptimizer } from './utils/imageOptimizer';

// Load environment variables
dotenv.config();

// Create an instance of the storage service
const storageService = new BlobStorageService();

/**
 * Test optimized uploads with parallel processing and image compression
 */
async function testOptimizedUpload() {
  console.log('Testing optimized file uploads to Azure Blob Storage...');
  
  try {
    // Create test directory if it doesn't exist
    const testDir = path.join(__dirname, '../test-files');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Create test files with different sizes
    const testFiles = [
      { name: 'small.bin', size: 0.5 }, // 0.5MB
      { name: 'medium.bin', size: 2 },  // 2MB
      { name: 'large.bin', size: 8 }    // 8MB
    ];
    
    console.log('Creating test files...');
    
    for (const file of testFiles) {
      const filePath = path.join(testDir, file.name);
      const fileSize = Math.floor(file.size * 1024 * 1024);
      
      // Create file with random data if it doesn't exist
      if (!fs.existsSync(filePath)) {
        console.log(`Creating ${file.name} (${file.size}MB)...`);
        const buffer = Buffer.alloc(fileSize);
        
        // Fill with random data
        for (let i = 0; i < buffer.length; i += 4) {
          buffer.writeUInt32LE(Math.floor(Math.random() * 0xFFFFFFFF), i);
        }
        
        fs.writeFileSync(filePath, buffer);
      }
    }
    
    // Test sequential uploads first
    console.log('\n--- Testing Sequential Uploads ---');
    const sequentialResults = await testSequentialUploads(testFiles, testDir);
    
    // Test parallel uploads
    console.log('\n--- Testing Parallel Uploads ---');
    const parallelResults = await testParallelUploads(testFiles, testDir);
    
    // Compare results
    console.log('\n--- Results Comparison ---');
    console.log('Sequential upload total time:', sequentialResults.totalTimeMs, 'ms');
    console.log('Parallel upload total time:', parallelResults.totalTimeMs, 'ms');
    console.log('Speed improvement:', (sequentialResults.totalTimeMs / parallelResults.totalTimeMs).toFixed(2) + 'x');
    
    // Test image optimization
    console.log('\n--- Testing Image Optimization ---');
    await testImageOptimization();
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

/**
 * Test sequential uploads
 */
async function testSequentialUploads(testFiles: { name: string, size: number }[], testDir: string) {
  const startTime = Date.now();
  const results = [];
  
  for (const file of testFiles) {
    const filePath = path.join(testDir, file.name);
    const fileContent = fs.readFileSync(filePath);
    
    console.log(`Uploading ${file.name} (${file.size}MB) sequentially...`);
    
    const fileStartTime = Date.now();
    
    const result = await storageService.uploadFile(
      'test-client',
      'test-sequential',
      file.name,
      fileContent,
      'application/octet-stream'
    );
    
    const fileEndTime = Date.now();
    const fileTimeMs = fileEndTime - fileStartTime;
    
    results.push({
      fileName: file.name,
      fileSize: file.size,
      timeMs: fileTimeMs,
      url: result.url
    });
    
    console.log(`Uploaded ${file.name} in ${fileTimeMs}ms`);
  }
  
  const endTime = Date.now();
  const totalTimeMs = endTime - startTime;
  
  console.log('Sequential upload results:');
  console.table(results);
  console.log(`Total time: ${totalTimeMs}ms`);
  
  return { results, totalTimeMs };
}

/**
 * Test parallel uploads
 */
async function testParallelUploads(testFiles: { name: string, size: number }[], testDir: string) {
  const startTime = Date.now();
  
  console.log('Starting parallel uploads...');
  
  const uploadPromises = testFiles.map(async (file) => {
    const filePath = path.join(testDir, file.name);
    const fileContent = fs.readFileSync(filePath);
    
    console.log(`Starting upload for ${file.name} (${file.size}MB)...`);
    
    const fileStartTime = Date.now();
    
    const result = await storageService.uploadFile(
      'test-client',
      'test-parallel',
      file.name,
      fileContent,
      'application/octet-stream'
    );
    
    const fileEndTime = Date.now();
    const fileTimeMs = fileEndTime - fileStartTime;
    
    console.log(`Completed upload for ${file.name} in ${fileTimeMs}ms`);
    
    return {
      fileName: file.name,
      fileSize: file.size,
      timeMs: fileTimeMs,
      url: result.url
    };
  });
  
  const results = await Promise.all(uploadPromises);
  
  const endTime = Date.now();
  const totalTimeMs = endTime - startTime;
  
  console.log('Parallel upload results:');
  console.table(results);
  console.log(`Total time: ${totalTimeMs}ms`);
  
  return { results, totalTimeMs };
}

/**
 * Test image optimization
 */
async function testImageOptimization() {
  try {
    // Create a test image if it doesn't exist
    const testImagePath = path.join(__dirname, '../test-files/test-image.jpg');
    
    if (!fs.existsSync(testImagePath)) {
      console.log('No test image found. Please place a test image at test-files/test-image.jpg');
      return;
    }
    
    console.log('Testing image optimization...');
    
    // Read the test image
    const imageBuffer = fs.readFileSync(testImagePath);
    console.log(`Original image size: ${(imageBuffer.length / 1024).toFixed(2)}KB`);
    
    // Optimize the image
    const optimizationResult = await ImageOptimizer.optimizeImage(
      imageBuffer,
      'image/jpeg',
      'test-image.jpg'
    );
    
    console.log(`Optimized image size: ${(optimizationResult.buffer.length / 1024).toFixed(2)}KB`);
    console.log(`Compression rate: ${optimizationResult.compressionRate.toFixed(2)}x`);
    
    // Upload both original and optimized images
    console.log('\nUploading original image...');
    const originalStartTime = Date.now();
    
    await storageService.uploadFile(
      'test-client',
      'test-optimization',
      'original-image.jpg',
      imageBuffer,
      'image/jpeg'
    );
    
    const originalEndTime = Date.now();
    const originalTimeMs = originalEndTime - originalStartTime;
    
    console.log(`Original image upload time: ${originalTimeMs}ms`);
    
    console.log('\nUploading optimized image...');
    const optimizedStartTime = Date.now();
    
    await storageService.uploadFile(
      'test-client',
      'test-optimization',
      'optimized-image.jpg',
      optimizationResult.buffer,
      optimizationResult.mimetype
    );
    
    const optimizedEndTime = Date.now();
    const optimizedTimeMs = optimizedEndTime - optimizedStartTime;
    
    console.log(`Optimized image upload time: ${optimizedTimeMs}ms`);
    console.log(`Upload speed improvement: ${(originalTimeMs / optimizedTimeMs).toFixed(2)}x`);
    
  } catch (error) {
    console.error('Error testing image optimization:', error);
  }
}

// Run the test
testOptimizedUpload().catch(console.error); 