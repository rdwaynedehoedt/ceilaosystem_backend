import fs from 'fs';
import path from 'path';

// Check if a directory exists
function directoryExists(dirPath: string): boolean {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch (error) {
    return false;
  }
}

// List all files in a directory and its subdirectories
function listFilesRecursively(dirPath: string, baseDir: string = ''): void {
  if (!directoryExists(dirPath)) {
    console.log(`Directory does not exist: ${dirPath}`);
    return;
  }

  const files = fs.readdirSync(dirPath);
  
  console.log(`\nContents of ${baseDir || dirPath}:`);
  if (files.length === 0) {
    console.log('  (empty directory)');
    return;
  }

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const relativePath = baseDir ? path.join(baseDir, file) : file;
    
    try {
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        console.log(`  📁 ${relativePath}/`);
        listFilesRecursively(filePath, relativePath);
      } else {
        console.log(`  📄 ${relativePath} (${formatSize(stats.size)})`);
      }
    } catch (error) {
      console.log(`  ❌ Error accessing ${relativePath}: ${error}`);
    }
  }
}

// Format file size in a human-readable format
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

// Check for "uploads" directory in various locations
const possibleUploadDirs = [
  './uploads',
  '../uploads',
  '../../uploads',
  'uploads',
];

console.log('Checking for upload directories...');
let foundAny = false;

for (const dir of possibleUploadDirs) {
  if (directoryExists(dir)) {
    console.log(`✅ Found uploads directory at: ${path.resolve(dir)}`);
    listFilesRecursively(dir);
    foundAny = true;
  } else {
    console.log(`❌ No uploads directory at: ${path.resolve(dir)}`);
  }
}

if (!foundAny) {
  console.log('No uploads directories found in any of the checked locations.');
}

// Check the current working directory
console.log(`\nCurrent working directory: ${process.cwd()}`);
console.log('Files in current directory:');
listFilesRecursively('.'); 