const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// Test the document upload with new document types
async function testDocumentUpload() {
  const baseURL = 'http://localhost:5000/api';
  
  // Create a test file
  const testContent = 'This is a test document for quotation_doc';
  const testFilePath = './test-document.txt';
  fs.writeFileSync(testFilePath, testContent);
  
  try {
    // Test with the new document type
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFilePath));
    
    console.log('Testing document upload for quotation_doc...');
    
    const response = await axios.post(
      `${baseURL}/documents/upload/new-client/quotation_doc`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': 'Bearer test-token' // You'll need a real token
        }
      }
    );
    
    console.log('✅ Upload successful:', response.data);
  } catch (error) {
    console.error('❌ Upload failed:', error.response?.data || error.message);
  } finally {
    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  }
}

// Test all new document types
async function testAllNewDocumentTypes() {
  const newDocumentTypes = [
    'proposal_form_doc',
    'quotation_doc', 
    'schedule_doc',
    'cr_copy_doc',
    'invoice_debit_note_doc',
    'payment_receipt_doc',
    'nic_br_doc'
  ];
  
  console.log('Testing all new document types...');
  
  for (const docType of newDocumentTypes) {
    console.log(`\nTesting: ${docType}`);
    
    // Create a test file for this document type
    const testContent = `Test content for ${docType}`;
    const testFilePath = `./test-${docType}.txt`;
    fs.writeFileSync(testFilePath, testContent);
    
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(testFilePath));
      
      const response = await axios.post(
        `http://localhost:5000/api/documents/upload/new-client/${docType}`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': 'Bearer test-token' // You'll need a real token
          }
        }
      );
      
      console.log(`✅ ${docType}: Success`);
    } catch (error) {
      console.log(`❌ ${docType}: Failed - ${error.response?.data?.message || error.message}`);
    } finally {
      // Clean up test file
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  }
}

// Run the test
if (require.main === module) {
  console.log('Starting document upload tests...');
  testAllNewDocumentTypes()
    .then(() => {
      console.log('\n✅ All tests completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
} 