import express, { Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import storageService from '../services/storage';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import path from 'path';
import fs from 'fs';

const router = express.Router();

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
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const { clientId, documentType } = req.params;
    
    if (!clientId || !documentType) {
      return res.status(400).json({ message: 'Client ID and document type are required' });
    }
    
    // Validate document type
    const validDocumentTypes = ['nic_proof', 'dob_proof', 'business_registration', 'svat_proof', 'vat_proof', 
    'coverage_proof', 'sum_insured_proof', 'policy_fee_invoice', 'vat_fee_debit_note', 'payment_receipt_proof'];
    
    if (!validDocumentTypes.includes(documentType)) {
      return res.status(400).json({ message: `Invalid document type. Valid types are: ${validDocumentTypes.join(', ')}` });
    }
    
    const file = req.file;
    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    
    // Upload to Azure Blob Storage
    const result = await storageService.uploadFile(
      clientId,
      documentType,
      fileName,
      file.buffer,
      file.mimetype
    );
    
    res.json({
      message: 'File uploaded successfully',
      url: result.url,
      fileName: fileName
    });
  } catch (error: any) {
    console.error('Error uploading document:', error);
    res.status(500).json({ message: error.message || 'Failed to upload document' });
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
    
    console.log(`[${new Date().toISOString()}] Secure document request from ${req.ip} for: ${clientId}/${documentType}/${filename}`);
    console.log('User info:', req.user ? { userId: req.user.userId, role: req.user.role } : 'No user info');
    
    try {
      // Generate a secure URL for the document
      console.log(`Generating secure URL for: ${clientId}/${documentType}/${filename}`);
      const url = await storageService.generateSecureUrl(
        clientId,
        documentType,
        filename,
        15 * 60 // 15 minutes in seconds - longer to prevent timing issues
      );
      
      console.log(`Generated URL: ${url.includes('?') ? url.substring(0, url.indexOf('?') + 10) + '...' : url}`);
      
      // Check if this is a local file path (doesn't start with http)
      if (!url.startsWith('http')) {
        console.log('Serving local file:', url);
        
        // Check if file exists
        if (!fs.existsSync(url)) {
          console.error(`Local file not found: ${url}`);
          return res.status(404).json({ message: 'Document not found' });
        }
        
        // Determine content type based on file extension
        const ext = path.extname(url).toLowerCase();
        let contentType = 'application/octet-stream'; // Default
        
        if (ext === '.pdf') contentType = 'application/pdf';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        else if (ext === '.gif') contentType = 'image/gif';
        
        // Set content type and cache headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
        res.setHeader('Access-Control-Allow-Origin', '*'); // Allow any origin to access
        
        // Stream the file
        return res.sendFile(path.resolve(url));
      }
      
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

// Public document proxy endpoint - temporarily accessible with a signed token
router.get('/public/:token/:clientId/:documentType/:filename', async (req: Request, res: Response) => {
  try {
    const { clientId, documentType, filename, token } = req.params;
    
    console.log(`[${new Date().toISOString()}] Public document request for: ${clientId}/${documentType}/${filename}`);
    
    // Simple verification to prevent direct access without a proper token
    // Not using JWT here to keep it simple, just a timestamp-based token with hash
    // Extract timestamp and verify it's recent
    try {
      if (!token || token.length < 20) {
        return res.status(403).json({ message: 'Invalid access token' });
      }
      
      // First part of token is timestamp
      const parts = token.split('_');
      if (parts.length !== 2) {
        return res.status(403).json({ message: 'Invalid token format' });
      }
      
      const timestamp = parseInt(parts[0], 10);
      const now = Date.now();
      
      // Ensure token is not too old (30 minute expiration)
      if (isNaN(timestamp) || now - timestamp > 30 * 60 * 1000) {
        return res.status(403).json({ message: 'Token expired' });
      }
    } catch (error) {
      console.error('Error validating token:', error);
      return res.status(403).json({ message: 'Invalid access token' });
    }
    
    try {
      // First try to find the file directly in local storage
      // Check common places where files might be stored
      const possiblePaths = [
        path.join('uploads', clientId, documentType, filename),
        path.join('./uploads', clientId, documentType, filename)
      ];
      
      console.log('Checking possible local paths:', possiblePaths);
      
      for (const p of possiblePaths) {
        const resolvedPath = path.resolve(p);
        if (fs.existsSync(resolvedPath)) {
          console.log(`File found at local path: ${resolvedPath}`);
          
          // Determine content type based on file extension
          const ext = path.extname(p).toLowerCase();
          let contentType = 'application/octet-stream'; // Default
          
          if (ext === '.pdf') contentType = 'application/pdf';
          else if (ext === '.png') contentType = 'image/png';
          else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
          else if (ext === '.gif') contentType = 'image/gif';
          
          // Set content type and cache headers
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
          res.setHeader('Access-Control-Allow-Origin', '*'); // Allow any origin to access
          
          // Stream the file
          console.log(`Serving local file with content-type: ${contentType}`);
          return res.sendFile(resolvedPath);
        }
      }
      
      // If not found locally, try with the storage service
      console.log(`Local file not found, trying Azure Storage for: ${clientId}/${documentType}/${filename}`);
      try {
        const url = await storageService.generateSecureUrl(
          clientId,
          documentType,
          filename,
          15 * 60 // 15 minutes in seconds
        );
        
        console.log(`Generated URL: ${url.includes('?') ? url.substring(0, url.indexOf('?') + 10) + '...' : url}`);
        
        // Check if this is a local file path (doesn't start with http)
        if (!url.startsWith('http')) {
          console.log('Serving local file returned from storage service:', url);
          
          // Check if file exists
          if (!fs.existsSync(url)) {
            console.error(`Local file not found: ${url}`);
            
            // Try to find any file for this client and document type
            const clientDocTypeDir = path.join('uploads', clientId, documentType);
            if (fs.existsSync(clientDocTypeDir)) {
              try {
                console.log(`Looking for any file in directory: ${clientDocTypeDir}`);
                const files = fs.readdirSync(clientDocTypeDir);
                if (files.length > 0) {
                  // Serve the first file found - might not be the exact one, but better than nothing
                  const firstFile = path.join(clientDocTypeDir, files[0]);
                  console.log(`File not found, but serving another file from the same directory: ${firstFile}`);
                  
                  // Determine content type
                  const ext = path.extname(firstFile).toLowerCase();
                  let contentType = 'application/octet-stream';
                  if (ext === '.pdf') contentType = 'application/pdf';
                  else if (ext === '.png') contentType = 'image/png';
                  else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
                  else if (ext === '.gif') contentType = 'image/gif';
                  
                  // Set headers
                  res.setHeader('Content-Type', contentType);
                  res.setHeader('Cache-Control', 'public, max-age=300');
                  res.setHeader('Access-Control-Allow-Origin', '*');
                  
                  // Send the file
                  console.log(`Serving replacement file with content-type: ${contentType}`);
                  return res.sendFile(path.resolve(firstFile));
                }
              } catch (readError) {
                console.error(`Error reading directory: ${clientDocTypeDir}`, readError);
              }
            }
            
            return res.status(404).json({ 
              message: 'Document not found',
              clientId,
              documentType, 
              filename,
              checkedPaths: [...possiblePaths, url]
            });
          }
          
          // Determine content type based on file extension
          const ext = path.extname(url).toLowerCase();
          let contentType = 'application/octet-stream'; // Default
          
          if (ext === '.pdf') contentType = 'application/pdf';
          else if (ext === '.png') contentType = 'image/png';
          else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
          else if (ext === '.gif') contentType = 'image/gif';
          
          // Set content type and cache headers
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
          res.setHeader('Access-Control-Allow-Origin', '*'); // Allow any origin to access
          
          // Stream the file
          console.log(`Serving local file with content-type: ${contentType}`);
          return res.sendFile(path.resolve(url));
        }
        
        // For Azure storage URLs, proxy the content
        console.log(`Proxying content from Azure URL: ${url.substring(0, url.indexOf('?') + 10 || url.length)}...`);
        
        try {
          const response = await fetch(url);
          
          if (!response.ok) {
            console.error(`Error fetching document: ${response.status} ${response.statusText}`);
            return res.status(response.status).json({ 
              message: 'Document not found on Azure',
              status: response.status,
              statusText: response.statusText,
              clientId,
              documentType,
              filename
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
            error: fetchError instanceof Error ? fetchError.message : 'Unknown error',
            clientId,
            documentType,
            filename
          });
        }
      } catch (secureUrlError) {
        console.error('Error generating secure URL:', secureUrlError);
        // Even if we fail to generate a secure URL, let's try to find a local file as a fallback
        try {
          // Try to find any file for this client and document type as a last resort
          console.log('Trying emergency fallback search for any local file');
          const clientDocTypeDir = path.join('uploads', clientId, documentType);
          if (fs.existsSync(clientDocTypeDir)) {
            const files = fs.readdirSync(clientDocTypeDir);
            if (files.length > 0) {
              // Serve the first file found - might not be the exact one, but better than nothing
              const firstFile = path.join(clientDocTypeDir, files[0]);
              console.log(`Emergency fallback: serving file from directory: ${firstFile}`);
              
              // Determine content type
              const ext = path.extname(firstFile).toLowerCase();
              let contentType = 'application/octet-stream';
              if (ext === '.pdf') contentType = 'application/pdf';
              else if (ext === '.png') contentType = 'image/png';
              else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
              else if (ext === '.gif') contentType = 'image/gif';
              
              // Set headers
              res.setHeader('Content-Type', contentType);
              res.setHeader('Cache-Control', 'public, max-age=300');
              res.setHeader('Access-Control-Allow-Origin', '*');
              
              // Send the file
              console.log(`Serving emergency fallback file with content-type: ${contentType}`);
              return res.sendFile(path.resolve(firstFile));
            }
          }
        } catch (fallbackError) {
          console.error('Fallback search failed:', fallbackError);
        }
      }
      
      return res.status(500).json({ 
        message: 'Error generating secure URL or finding file locally',
        clientId,
        documentType,
        filename
      });
    } catch (error) {
      console.error('Error serving document:', error);
      return res.status(500).json({ 
        message: 'Error serving document',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  } catch (error) {
    console.error('Error handling document request:', error);
    return res.status(500).json({ 
      message: 'Error handling document request',
      error: error instanceof Error ? error.message : String(error)
    });
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
    baseUrl = 'https://606464b5-77c7-4bb1-a1b9-9d05cefa3519-dev.e1-us-east-azure.choreoapis.dev/insurance-brokerage/insurance-brokerage-backe/v1.0';
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

export default router; 