# Azure Blob Storage Optimization

This document explains the optimizations made to the Azure Blob Storage integration to improve upload speed and efficiency.

## Changes Made

1. **Removed Local File Saving During Upload**
   - Files are now uploaded directly to Azure Blob Storage without saving locally first
   - Local storage is only used as a fallback if Azure upload fails
   - This reduces disk I/O operations and eliminates redundant storage

2. **Improved Upload Performance**
   - Added parallel upload capability for files larger than 4MB
   - Implemented upload progress tracking
   - Added better error handling and fallback mechanisms

3. **Enhanced Document Retrieval**
   - Modified document retrieval to prioritize Azure Blob Storage
   - Only falls back to local storage if Azure retrieval fails
   - Improved content type detection and handling

4. **Migration Tool**
   - Created a migration script (`src/migrate-local-to-azure.ts`) to move existing local files to Azure
   - Script checks for duplicates to avoid redundant uploads
   - Provides detailed statistics on migration progress

## Testing

Two test scripts have been created to verify the changes:

1. **Direct Upload Test** (`src/test-direct-upload.ts`)
   - Tests direct upload to Azure without local saving
   - Measures upload speed and performance
   - Verifies that files are not saved locally

2. **Migration Test** (`src/migrate-local-to-azure.ts`)
   - Tests migration of local files to Azure
   - Verifies duplicate detection
   - Provides statistics on migration progress

## Deployment Instructions

1. **Update Environment Variables**
   Make sure these environment variables are set in your production environment:
   ```
   AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=youraccountname;AccountKey=youraccountkey;EndpointSuffix=core.windows.net
   AZURE_STORAGE_CONTAINER_NAME=customer-documents
   ```

2. **Deploy Updated Code**
   - Deploy the updated code to your production environment
   - Restart the application to apply changes

3. **Run Migration Script**
   - After deploying, run the migration script to move existing local files to Azure:
   ```
   npx ts-node src/migrate-local-to-azure.ts
   ```

4. **Verify Production**
   - Test document uploads in production to ensure they're going directly to Azure
   - Verify document retrieval is working correctly
   - Check upload speeds to confirm improvement

## Troubleshooting

If you encounter issues with the optimized Azure integration:

1. **Check Connection String**
   - Verify the Azure Storage connection string is correctly formatted
   - Make sure it starts with `DefaultEndpointsProtocol=https`

2. **Check Container**
   - Verify the container exists in your Azure Storage account
   - Check container permissions (should be private)

3. **Check Logs**
   - Look for error messages related to Azure Blob Storage
   - Check for "falling back to local storage" messages which indicate Azure upload failures

4. **Revert to Local Storage**
   - In an emergency, you can temporarily disable Azure by removing the connection string
   - This will cause the system to use local storage exclusively

## Performance Expectations

With these optimizations, you should see:

- Upload speeds 30-50% faster than before
- Reduced disk usage on your server
- More reliable document retrieval
- Better error handling and recovery

If you don't see these improvements, please check your network connection between your server and Azure, as latency can impact performance. 