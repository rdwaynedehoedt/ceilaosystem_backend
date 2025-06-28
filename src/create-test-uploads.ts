import fs from 'fs';
import path from 'path';

// Create directory if it doesn't exist
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

// Create a test file with content
function createTestFile(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content);
  console.log(`Created file: ${filePath}`);
}

// Main function to create test uploads structure
function createTestUploads(): void {
  console.log('Creating test uploads directory structure...');
  
  // Create base uploads directory
  const uploadsDir = path.resolve('./uploads');
  ensureDir(uploadsDir);
  
  // Create client directories
  const clientIds = ['C4de77dc9'];
  
  for (const clientId of clientIds) {
    const clientDir = path.join(uploadsDir, clientId);
    ensureDir(clientDir);
    
    // Create document type directories and files
    const documentTypes = [
      'nic_proof',
      'dob_proof',
      'business_registration',
      'svat_proof',
      'vat_proof',
      'coverage_proof',
      'sum_insured_proof',
      'policy_fee_invoice',
      'vat_fee_debit_note',
      'payment_receipt_proof'
    ];
    
    for (const docType of documentTypes) {
      const docTypeDir = path.join(clientDir, docType);
      ensureDir(docTypeDir);
      
      // Create a test file with UUID-like name
      let fileName = '';
      switch (docType) {
        case 'nic_proof':
          fileName = 'b70483c4-7b2a-4b01-860d-e8e569dc7850.png';
          break;
        case 'dob_proof':
          fileName = 'bdc864d9-aa93-4743-8818-1d6ab7450527.png';
          break;
        case 'business_registration':
          fileName = '1275bb72-516c-478c-9250-bdf14b2a1cbb.png';
          break;
        case 'svat_proof':
          fileName = '154c6caa-d947-4134-9c23-84e3a2132ebf.png';
          break;
        case 'vat_proof':
          fileName = '3034f687-ec63-4ea8-9a48-589a106a9f35.jpeg';
          break;
        case 'coverage_proof':
          fileName = '09768300-caf6-4948-a237-34dee19dcf8f.png';
          break;
        case 'sum_insured_proof':
          fileName = 'a2840a3e-d235-4ade-b646-b10ce673b137.png';
          break;
        case 'policy_fee_invoice':
          fileName = '4996a0ff-5908-4fb5-b255-d9615d01e373.png';
          break;
        case 'vat_fee_debit_note':
          fileName = '4bd9c859-9fbd-4dc4-b8cf-4511f09a13c2.png';
          break;
        case 'payment_receipt_proof':
          fileName = '924fbc48-b297-4f3b-a7bd-734c82183da4.png';
          break;
        default:
          fileName = `${Date.now()}.png`;
      }
      
      const filePath = path.join(docTypeDir, fileName);
      
      // Create a simple image file (a minimal valid PNG file)
      const pngHeader = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
        0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);
      
      // Write the PNG header to file
      fs.writeFileSync(filePath, pngHeader);
      console.log(`Created file: ${filePath}`);
    }
  }
  
  console.log('\nTest uploads directory structure created successfully!');
  console.log(`Created in: ${uploadsDir}`);
}

// Run the function
createTestUploads(); 