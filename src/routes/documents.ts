import express, { Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { BlobStorageService } from '../services/storage';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import path from 'path';
import fs from 'fs';
import { BlobServiceClient, BlobSASPermissions } from '@azure/storage-blob';
import fetch from 'node-fetch';
import { ImageOptimizer } from '../utils/imageOptimizer';

const router = express.Router();
const storageService = new BlobStorageService();

// Configure multer for memory storage (files will be stored in memory as Buffer objects)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only certain file types
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF files are allowed.'));
    }
  },
});

/**
 * @route POST /api/documents/upload/:clientId/:documentType
 * @desc Upload a document for a client
 * @access Private
 */
router.post('/upload/:clientId/:documentType', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { clientId, documentType } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    console.log(`[${new Date().toISOString()}] Document upload request from ${req.ip}`);
    console.log(`Client ID: ${clientId}, Document Type: ${documentType}`);
    console.log(`Original filename: ${req.file.originalname}, Size: ${(req.file.size / 1024).toFixed(2)}KB`);
    
    // Start timing the upload process
    const startTime = Date.now();
    
    // Check if the file is an image and optimize it if it is
    let fileBuffer = req.file.buffer;
    let fileMimetype = req.file.mimetype;
    let fileExtension = path.extname(req.file.originalname);
    
    // Optimize images before upload
    if (ImageOptimizer.isImage(req.file.mimetype)) {
      console.log('Optimizing image before upload...');
      const optimizationResult = await ImageOptimizer.optimizeImage(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname
      );
      
      fileBuffer = optimizationResult.buffer;
      fileMimetype = optimizationResult.mimetype;
      fileExtension = optimizationResult.extension;
      
      console.log(`Image optimized. Compression rate: ${optimizationResult.compressionRate.toFixed(2)}x`);
    }
    
    // Generate a unique filename with the correct extension
    const fileName = `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}${fileExtension}`;
    
    // Upload the file to Azure Blob Storage
    const result = await storageService.uploadFile(
      clientId,
      documentType,
      fileName,
      fileBuffer,
      fileMimetype
    );
    
    // Calculate total processing time
    const endTime = Date.now();
    const processingTimeMs = endTime - startTime;
    
    console.log(`Document uploaded successfully. URL: ${result.url}`);
    console.log(`Total processing time: ${processingTimeMs}ms`);
    
    return res.status(200).json({
      message: 'File uploaded successfully',
      url: result.url,
      fileName: fileName,
      processingTimeMs
    });
  } catch (error: any) {
    console.error('Error uploading document:', error);
    return res.status(500).json({ message: `Error uploading document: ${error.message}` });
  }
});

/**
 * @route GET /api/documents/:clientId/:documentType/url
 * @desc Get a temporary URL for accessing a document
 * @access Private
 */
router.get('/:clientId/:documentType/url', authenticate, async (req: Request, res: Response) => {
  try {
    const { clientId, documentType } = req.params;
    const { blobUrl } = req.query;
    
    if (!blobUrl || typeof blobUrl !== 'string') {
      return res.status(400).json({ message: 'Blob URL is required' });
    }
    
    console.log('Generate secure URL request for:', blobUrl);
    
    // Extract filename from the blob URL
    let fileName = '';
    
    if (blobUrl.startsWith('http')) {
      // Handle Azure Blob Storage URL
      // Format: https://{account}.blob.core.windows.net/{container}/{clientId}/{documentType}/{filename}?{SAS}
      try {
        // Remove query parameters first
        const urlWithoutParams = blobUrl.split('?')[0];
        
        // Get the last segment which should be the filename
        const pathSegments = urlWithoutParams.split('/');
        fileName = pathSegments[pathSegments.length - 1];
        
        console.log('Extracted filename from Azure URL:', fileName);
      } catch (error) {
        console.error('Error parsing Azure URL:', error);
        return res.status(400).json({ message: 'Failed to parse blob URL' });
      }
    } else {
      // Handle local storage path
      // Format: uploads/{clientId}/{documentType}/{filename}
      const pathSegments = blobUrl.split(/[\/\\]/);
      fileName = pathSegments[pathSegments.length - 1];
      console.log('Extracted filename from local path:', fileName);
    }
    
    if (!fileName) {
      return res.status(400).json({ message: 'Invalid blob URL, could not extract filename' });
    }
    
    // Generate a secure URL using the new method
    const secureUrl = await storageService.generateSecureUrl(
      clientId,
      documentType,
      fileName
    );
    
    res.json({
      sasUrl: secureUrl,
      expiresIn: '5 minutes',
    });
  } catch (error: any) {
    console.error('Error generating secure URL:', error);
    res.status(500).json({ message: error.message || 'Failed to generate document URL' });
  }
});

/**
 * @route DELETE /api/documents/:clientId/:documentType
 * @desc Delete a document
 * @access Private
 */
router.delete('/:clientId/:documentType', authenticate, async (req: Request, res: Response) => {
  try {
    const { clientId, documentType } = req.params;
    const { blobUrl } = req.query;
    
    if (!blobUrl || typeof blobUrl !== 'string') {
      return res.status(400).json({ message: 'Blob URL is required' });
    }
    
    console.log('Delete request for URL:', blobUrl);
    
    // Extract filename from the blob URL
    let fileName = '';
    
    if (blobUrl.startsWith('http')) {
      // Handle Azure Blob Storage URL
      // Format: https://{account}.blob.core.windows.net/{container}/{clientId}/{documentType}/{filename}?{SAS}
      try {
        // Remove query parameters first
        const urlWithoutParams = blobUrl.split('?')[0];
        
        // Get the last segment which should be the filename
        const pathSegments = urlWithoutParams.split('/');
        fileName = pathSegments[pathSegments.length - 1];
        
        console.log('Extracted filename from Azure URL:', fileName);
      } catch (error) {
        console.error('Error parsing Azure URL:', error);
        return res.status(400).json({ message: 'Failed to parse blob URL' });
      }
    } else {
      // Handle local storage path
      // Format: uploads/{clientId}/{documentType}/{filename}
      const pathSegments = blobUrl.split(/[\/\\]/);
      fileName = pathSegments[pathSegments.length - 1];
      console.log('Extracted filename from local path:', fileName);
    }
    
    if (!fileName) {
      return res.status(400).json({ message: 'Invalid blob URL, could not extract filename' });
    }
    
    // Delete the document using the new method
    await storageService.deleteFile(clientId, documentType, fileName);
    
    res.json({ message: 'Document deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting document:', error);
    res.status(500).json({ message: error.message || 'Failed to delete document' });
  }
});

// Secure document proxy endpoint - requires authentication
router.get('/secure/:clientId/:documentType/:filename', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { clientId, documentType, filename } = req.params;
    
    console.log(`[${new Date().toISOString()}] Secure document request for: ${clientId}/${documentType}/${filename}`);
    
    // Get a secure URL from the storage service
    try {
      const url = await storageService.generateSecureUrl(clientId, documentType, filename);
      
      // For Azure storage URLs, proxy the content
      console.log(`Proxying content from Azure URL: ${url.substring(0, url.indexOf('?') + 10 || url.length)}...`);
      
      // IMPORTANT: Since public access is not permitted, we MUST proxy the content
      // instead of redirecting to the Azure URL directly
      try {
        const response = await fetch(url);
        
        if (!response.ok) {
          console.error(`Error fetching document: ${response.status} ${response.statusText}`);
          return res.status(response.status).json({ 
            message: 'Document not found',
            status: response.status,
            statusText: response.statusText
          });
        }
        
        // Get the file's content type and set it in the response
        const contentType = response.headers.get('content-type');
        if (contentType) {
          res.setHeader('Content-Type', contentType);
        }
        
        // Set cache headers to allow caching
        res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
        res.setHeader('Access-Control-Allow-Origin', '*'); // Allow any origin to access
        
        // Stream the response back to the client
        const blob = await response.blob();
        const buffer = Buffer.from(await blob.arrayBuffer());
        
        console.log(`Successfully proxied document, size: ${buffer.length} bytes, content-type: ${contentType || 'unknown'}`);
        
        return res.send(buffer);
      } catch (fetchError) {
        console.error('Error fetching document from Azure:', fetchError);
        return res.status(500).json({ 
          message: 'Error retrieving document content',
          error: fetchError instanceof Error ? fetchError.message : 'Unknown error'
        });
      }
    } catch (error) {
      console.error('Error generating secure URL:', error);
      return res.status(500).json({ message: 'Error generating secure URL' });
    }
  } catch (error) {
    console.error('Error serving document:', error);
    return res.status(500).json({ message: 'Error serving document' });
  }
});

// Add a document delete endpoint that uses the same pattern as our secure endpoint
router.delete('/delete/:clientId/:documentType/:filename', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { clientId, documentType, filename } = req.params;
    
    console.log('DELETE request received for:', { clientId, documentType, filename });
    console.log('Request headers:', req.headers);
    console.log('Request path:', req.path);
    
    // Extract just the filename from any paths that might be included
    // This handles cases where the frontend sends a full path instead of just the filename
    const baseFileName = filename.split(/[\/\\]/).pop() || filename;
    
    console.log('Using base filename for deletion:', baseFileName);
    
    try {
      // Delete the file using the extracted filename
      const success = await storageService.deleteFile(clientId, documentType, baseFileName);
      
      console.log('Delete operation result:', success);
      
      if (success) {
        return res.json({ message: 'File deleted successfully' });
      } else {
        return res.status(404).json({ message: 'File not found or could not be deleted' });
      }
    } catch (deleteError: any) {
      console.error('Error in storage delete operation:', deleteError);
      return res.status(500).json({ message: 'Error deleting file: ' + (deleteError.message || 'Unknown error') });
    }
  } catch (error) {
    console.error('Error processing delete request:', error);
    return res.status(500).json({ message: 'Error deleting document' });
  }
});

// Handle public document requests with token
router.get('/public/:token/:clientId/:documentType/:filename', async (req: Request, res: Response) => {
  try {
    const { token, clientId, documentType, filename } = req.params;
    
    // Simple token validation - just check if it's not too old (30 minutes)
    // In a production environment, you would use a more secure token system
    const tokenParts = token.split('_');
    if (tokenParts.length < 2) {
      return res.status(401).json({ message: 'Invalid token format' });
    }
    
    const timestamp = parseInt(tokenParts[0], 10);
    const now = Date.now();
    const tokenAge = now - timestamp;
    const maxTokenAge = 30 * 60 * 1000; // 30 minutes
    
    if (tokenAge > maxTokenAge) {
      return res.status(401).json({ message: 'Token expired' });
    }
    
    console.log(`[${new Date().toISOString()}] Public document request for: ${clientId}/${documentType}/${filename}`);
    
    // Get the file from Azure Blob Storage
    if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
      return res.status(500).json({ message: 'Azure Storage connection string not configured' });
    }
    
    console.log('Retrieving document from Azure Blob Storage');
    
    // Create a blob service client
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING
    );
    
    // Get a container client
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'customer-documents';
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Get a blob client
    const blobPath = `${clientId}/${documentType}/${filename}`;
    const blobClient = containerClient.getBlobClient(blobPath);
    
    // Check if the blob exists
    const exists = await blobClient.exists();
    
    if (!exists) {
      console.error(`Document not found in Azure: ${blobPath}`);
      return res.status(404).json({ message: 'Document not found' });
    }
    
    console.log('Document found in Azure Blob Storage');
    
    // Generate a SAS URL with short expiry
    const sasOptions = {
      expiresOn: new Date(new Date().valueOf() + 5 * 60 * 1000), // 5 minutes
      permissions: BlobSASPermissions.parse("r"), // Read-only permission
      contentDisposition: 'inline'
    };
    
    const sasUrl = await blobClient.generateSasUrl(sasOptions);
    
    // Get content type from blob properties
    const properties = await blobClient.getProperties();
    const contentType = properties.contentType || 'application/octet-stream';
    
    // Proxy the content from Azure
    const response = await fetch(sasUrl);
          
          if (!response.ok) {
      throw new Error(`Failed to fetch blob: ${response.status} ${response.statusText}`);
    }
    
    // Set content type and cache headers
            res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
    
    // Stream the response
          const blob = await response.blob();
          const buffer = Buffer.from(await blob.arrayBuffer());
          
    console.log(`Successfully retrieved document from Azure, size: ${buffer.length} bytes`);
          return res.send(buffer);
  } catch (error: any) {
      console.error('Error serving document:', error);
    return res.status(500).json({ message: `Error serving document: ${error.message}` });
  }
});

// Generate a public temporary token for document access
router.get('/token/:clientId/:documentType/:filename', authenticate, (req: Request, res: Response) => {
  const { clientId, documentType, filename } = req.params;
  
  // Create a simple time-based token
  const timestamp = Date.now();
  const token = `${timestamp}_${Math.random().toString(36).substring(2, 15)}`;
  
  // Return the token and public URL
  // Use environment variable for production or fall back to request host
  const isProduction = process.env.NODE_ENV === 'production';
  console.log('Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    isProduction,
    PUBLIC_API_URL: process.env.PUBLIC_API_URL,
    host: req.get('host'),
    protocol: req.protocol
  });
  
  // Make sure we use the public URL in production
  let baseUrl;
  if (isProduction) {
    // HARDCODED FIX: Always use the Choreo URL in production
    baseUrl = 'https://606464b5-77c7-4bb1-a1b9-9d05cefa3519-dev.e1-us-east-azure.choreoapis.dev/ceilaosystem/bakcned/v1.0';
    console.log(`Using hardcoded Choreo URL: ${baseUrl}`);
  } else {
    baseUrl = req.protocol + '://' + req.get('host');
    console.log(`Using request host: ${baseUrl}`);
  }
  
  const publicUrl = `${baseUrl}/api/documents/public/${token}/${clientId}/${documentType}/${filename}`;
  console.log(`Generated public URL: ${publicUrl}`);
  
  res.json({
    token,
    url: publicUrl,
    expires: new Date(timestamp + 30 * 60 * 1000).toISOString() // 30 minutes
  });
});

/**
 * @route POST /api/documents/migrate/new-client/:newClientId
 * @desc Migrate documents from 'new-client' to the actual client ID
 * @access Private
 */
router.post('/migrate/new-client/:newClientId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { newClientId } = req.params;
    const { documentUrls } = req.body;
    
    if (!newClientId) {
      return res.status(400).json({ message: 'New client ID is required' });
    }
    
    if (!documentUrls || typeof documentUrls !== 'object') {
      return res.status(400).json({ message: 'Document URLs object is required' });
    }
    
    console.log(`Migrating documents to client ID ${newClientId}`);
    console.log('Document URLs to migrate:', documentUrls);
    
    // Initialize storage service
    const updatedUrls: Record<string, string> = {};
    
    // Process each document URL
    for (const [documentKey, url] of Object.entries(documentUrls)) {
      if (!url || typeof url !== 'string') {
        continue; // Skip if not a valid URL
      }
      
      // Check if this is a URL we should migrate (contains 'new-client' or 'temp-')
      const shouldMigrate = url.includes('new-client') || url.includes('/temp-');
      if (!shouldMigrate) {
        continue;
      }
      
      try {
        console.log(`Processing document: ${documentKey} with URL: ${url}`);
        
        // Extract document type and filename from the URL
        // URL format could be either:
        // 1. https://...blob.core.windows.net/customer-documents/new-client/documentType/filename
        // 2. https://...blob.core.windows.net/customer-documents/temp-123456789/documentType/filename
        const urlParts = url.split('/');
        
        // Find the index of 'new-client' or the part that starts with 'temp-'
        let oldClientIdIndex = urlParts.findIndex(part => 
          part === 'new-client' || part.startsWith('temp-')
        );
        
        if (oldClientIdIndex <= 0 || oldClientIdIndex >= urlParts.length - 1) {
          console.error(`Invalid URL format for ${documentKey}: ${url}`);
          continue;
        }
        
        const documentType = urlParts[oldClientIdIndex + 1];
        const filename = urlParts[oldClientIdIndex + 2]?.split('?')[0]; // Remove query params
        
        if (!documentType || !filename) {
          console.error(`Could not extract document type or filename from URL: ${url}`);
          continue;
        }
        
        console.log(`Extracted: documentType=${documentType}, filename=${filename}`);
        
        // Download the file from the old location
        console.log(`Downloading file from: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
          console.error(`Failed to download file: ${response.status} ${response.statusText}`);
          continue;
        }
        
        const fileBuffer = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        
        // Upload to the new location
        console.log(`Uploading file to new location: ${newClientId}/${documentType}/${filename}`);
        const uploadResult = await storageService.uploadFile(
          newClientId,
          documentType,
          filename,
          fileBuffer,
          contentType
        );
        
        // Store the new URL
        updatedUrls[documentKey] = uploadResult.url;
        console.log(`File migrated successfully. New URL: ${uploadResult.url}`);
        
        // Don't delete the original file yet - keep it as a backup
        // We can add a cleanup job later if needed
      } catch (error) {
        console.error(`Error migrating document ${documentKey}:`, error);
        // Continue with other documents even if one fails
      }
    }
    
    console.log('Document migration completed');
    res.json({
      message: 'Documents migrated successfully',
      updatedUrls
    });
  } catch (error: any) {
    console.error('Error in document migration:', error);
    res.status(500).json({ message: error.message || 'Failed to migrate documents' });
  }
});

/**
 * @route POST /api/documents/migrate/:tempId/:newClientId
 * @desc Migrate documents from a specific temporary folder to the actual client ID
 * @access Private
 */
router.post('/migrate/:tempId/:newClientId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tempId, newClientId } = req.params;
    const { documentUrls } = req.body;
    
    if (!tempId || !newClientId) {
      return res.status(400).json({ message: 'Both temporary ID and new client ID are required' });
    }
    
    if (!documentUrls || typeof documentUrls !== 'object') {
      return res.status(400).json({ message: 'Document URLs object is required' });
    }
    
    console.log(`Migrating documents from temp ID ${tempId} to client ID ${newClientId}`);
    console.log('Document URLs to migrate:', documentUrls);
    
    // Initialize storage service
    const updatedUrls: Record<string, string> = {};
    
    // Process each document URL
    for (const [documentKey, url] of Object.entries(documentUrls)) {
      if (!url || typeof url !== 'string') {
        continue; // Skip if not a valid URL
      }
      
      try {
        console.log(`Processing document: ${documentKey} with URL: ${url}`);
        
        // Extract document type and filename from the URL
        // URL format: https://...blob.core.windows.net/customer-documents/temp-123456789/documentType/filename
        const urlParts = url.split('/');
        
        // Find the index of the part that matches our tempId
        let tempIdIndex = urlParts.findIndex(part => part === tempId);
        
        // If not found directly, look for any temp- part (fallback)
        if (tempIdIndex < 0) {
          tempIdIndex = urlParts.findIndex(part => part.startsWith('temp-'));
        }
        
        if (tempIdIndex <= 0 || tempIdIndex >= urlParts.length - 1) {
          console.error(`Invalid URL format for ${documentKey}: ${url}`);
          continue;
        }
        
        const documentType = urlParts[tempIdIndex + 1];
        const filename = urlParts[tempIdIndex + 2]?.split('?')[0]; // Remove query params
        
        if (!documentType || !filename) {
          console.error(`Could not extract document type or filename from URL: ${url}`);
          continue;
        }
        
        console.log(`Extracted: documentType=${documentType}, filename=${filename}`);
        
        // Download the file from the old location
        console.log(`Downloading file from: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
          console.error(`Failed to download file: ${response.status} ${response.statusText}`);
          continue;
        }
        
        const fileBuffer = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        
        // Upload to the new location
        console.log(`Uploading file to new location: ${newClientId}/${documentType}/${filename}`);
        const uploadResult = await storageService.uploadFile(
          newClientId,
          documentType,
          filename,
          fileBuffer,
          contentType
        );
        
        // Store the new URL
        updatedUrls[documentKey] = uploadResult.url;
        console.log(`File migrated successfully. New URL: ${uploadResult.url}`);
        
        // Don't delete the original file yet - keep it as a backup
        // We can add a cleanup job later if needed
      } catch (error) {
        console.error(`Error migrating document ${documentKey}:`, error);
        // Continue with other documents even if one fails
      }
    }
    
    console.log('Document migration completed');
    res.json({
      message: 'Documents migrated successfully',
      updatedUrls
    });
  } catch (error: any) {
    console.error('Error in document migration:', error);
    res.status(500).json({ message: error.message || 'Failed to migrate documents' });
  }
});

export default router; 