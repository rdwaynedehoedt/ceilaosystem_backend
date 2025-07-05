# Azure Blob Storage Deployment Checklist

## Issue Summary
Files are being saved locally in production instead of being uploaded to Azure Blob Storage, even though the database records contain Azure URLs. This causes 404 errors when trying to access the files.

## Verification Steps
1. ✅ Azure Blob Storage connection works locally
2. ✅ Files can be uploaded to Azure Blob Storage from local environment
3. ❌ Files are not being uploaded to Azure Blob Storage in production

## Deployment Checklist

### 1. Verify Environment Variables in Production
Make sure the following environment variables are properly set in your Choreo production environment:

- `AZURE_STORAGE_CONNECTION_STRING` - The full connection string to your Azure Storage account
- `AZURE_STORAGE_CONTAINER_NAME` - Should be set to "customer-documents"

You can check this in the Choreo dashboard under:
- Project: ceilaosystem
- Component: Bakcned
- Go to: Runtime → Configs & Secrets

### 2. Deploy Updated Code
Make sure the latest version of the storage service is deployed to production:

1. Build the application:
   ```
   npm run build
   ```

2. Deploy to Choreo:
   - Push your changes to the repository
   - Trigger a new deployment in Choreo

### 3. Verify Production Deployment
After deployment, you can verify if the storage service is working correctly by:

1. Checking the logs in Choreo after uploading a file
   - Look for messages like "File uploaded successfully to Azure"
   - If you see "FALLBACK: File saved locally", there's still an issue

2. Check if files are appearing in the Azure Blob Storage container
   - Use the Azure Portal to navigate to your storage account
   - Check the "customer-documents" container for new files

### 4. Migrate Existing Files (Optional)
If you have existing files that were saved locally but need to be in Azure:

1. Create a migration script that:
   - Reads files from the local storage
   - Uploads them to Azure Blob Storage with the same path
   - Keeps the same filenames to match the URLs in the database

## Troubleshooting

If files are still not being uploaded to Azure after deployment:

1. Check the logs for any errors related to Azure Blob Storage
2. Verify the connection string is correct and has the proper permissions
3. Make sure the storage account exists and is accessible from your deployment region
4. Check if there are any network restrictions preventing access to Azure Storage

## Testing in Production

You can add this test script to your production environment to verify the Azure connection:

```typescript
// test-azure-prod.ts
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
  
  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    console.log('Successfully created BlobServiceClient');
    
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const exists = await containerClient.exists();
    
    if (exists) {
      console.log(`Container "${containerName}" exists`);
    } else {
      console.log(`Container "${containerName}" does not exist`);
    }
    
    console.log('Azure Blob Storage connection test successful');
  } catch (error) {
    console.error('Azure Blob Storage connection test failed:', error);
  }
}

testAzureConnection().catch(console.error);
``` 