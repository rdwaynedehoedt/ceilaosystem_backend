import { Request, Response, Router } from 'express';
import { Client, ClientData } from '../models/Client';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

const router = Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({ dest: uploadsDir });

// Get all clients - accessible to managers and sales reps
router.get('/', authenticate, authorize(['admin', 'manager']), async (req: AuthRequest, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const search = req.query.search as string | undefined;
    
    // Get both the clients for the current page and the total count
    let clients, totalCount;
    
    if (search && search.trim() !== '') {
      // If searching, use the search method with pagination
      [clients, totalCount] = await Promise.all([
        Client.searchWithPagination(search, limit, offset),
        Client.getSearchResultCount(search)
      ]);
    } else {
      // Otherwise get all clients with pagination
      [clients, totalCount] = await Promise.all([
        Client.getAll(limit, offset),
        Client.getTotalCount()
      ]);
    }
    
    res.status(200).json({ 
      success: true, 
      data: clients,
      totalCount
    });
  } catch (error) {
    console.error('Error getting clients:', error);
    res.status(500).json({ success: false, message: 'Failed to get clients' });
  }
});

// Get client by ID
router.get('/:id', authenticate, authorize(['admin', 'manager']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const client = await Client.getById(id);
    
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    
    res.status(200).json({ success: true, data: client });
  } catch (error) {
    console.error('Error getting client by ID:', error);
    res.status(500).json({ success: false, message: 'Failed to get client' });
  }
});

// Create a new client
router.post('/', authenticate, authorize(['admin', 'manager']), async (req: AuthRequest, res: Response) => {
  try {
    const clientData: ClientData = req.body;
    
    console.log('Received client data:', JSON.stringify(clientData, null, 2));
    
    // Remove sales_rep_id if it exists - no longer needed
    if (clientData.sales_rep_id) {
      delete clientData.sales_rep_id;
    }
    
    // Validate required fields
    const requiredFields = ['customer_type', 'product', 'insurance_provider', 'client_name', 'mobile_no'];
    const missingFields = requiredFields.filter(field => !clientData[field as keyof ClientData]);
    
    if (missingFields.length > 0) {
      console.log('Missing required fields:', missingFields);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }
    
    const clientId = await Client.create(clientData);
    console.log('Client created with ID:', clientId);
    
    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      data: { id: clientId }
    });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ success: false, message: 'Failed to create client' });
  }
});

// Update a client
router.put('/:id', authenticate, authorize(['admin', 'manager']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const clientData: Partial<ClientData> = req.body;
    
    // Log the incoming data for debugging
    console.log(`Updating client ${id}:`, JSON.stringify(clientData, null, 2));
    
    // Check if client exists
    const existingClient = await Client.getById(id);
    if (!existingClient) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    
    // Remove sales_rep_id field if it's included in the update request
    if (clientData.sales_rep_id) {
      delete clientData.sales_rep_id;
    }
    
    // Sanitize numeric fields
    const sanitizedData: Partial<ClientData> = { ...clientData };
    const numericFields = [
      'sum_insured', 'basic_premium', 'srcc_premium', 'tc_premium', 
      'net_premium', 'stamp_duty', 'admin_fees', 'road_safety_fee', 
      'policy_fee', 'vat_fee', 'total_invoice', 'commission_basic',
      'commission_srcc', 'commission_tc', 'policies'
    ];
    
    numericFields.forEach(field => {
      if (field in sanitizedData) {
        const value = sanitizedData[field as keyof ClientData];
        if (value !== undefined && value !== null) {
          try {
            // Convert string values to numbers if needed
            if (typeof value === 'string') {
              const numValue = parseFloat(value);
              if (!isNaN(numValue)) {
                (sanitizedData as any)[field] = numValue;
              } else {
                console.warn(`Invalid numeric value for ${field}: ${value}`);
                (sanitizedData as any)[field] = 0;
              }
            }
          } catch (err) {
            console.error(`Error processing field ${field}:`, err);
            (sanitizedData as any)[field] = 0;
          }
        }
      }
    });
    
    // Try the update with sanitized data
    try {
      const updated = await Client.update(id, sanitizedData);
      
      if (!updated) {
        return res.status(500).json({
          success: false,
          message: 'Failed to update client - no rows affected'
        });
      }
      
      console.log(`Client ${id} successfully updated`);
      
      res.status(200).json({
        success: true,
        message: 'Client updated successfully'
      });
    } catch (updateError) {
      console.error('Database error updating client:', updateError);
      
      // Provide more specific error messages based on the error
      let errorMessage = 'Failed to update client due to database error';
      if (updateError instanceof Error) {
        errorMessage = `Database error: ${updateError.message}`;
      }
      
      return res.status(500).json({
        success: false,
        message: errorMessage,
        error: updateError instanceof Error ? updateError.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Error in client update route:', error);
    
    // Return detailed error for debugging
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update client',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete a client
router.delete('/:id', authenticate, authorize(['admin', 'manager']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if client exists
    const existingClient = await Client.getById(id);
    if (!existingClient) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    
    const deleted = await Client.delete(id);
    
    if (!deleted) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete client'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Client deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ success: false, message: 'Failed to delete client' });
  }
});

// Search clients
router.post('/search', authenticate, authorize(['admin', 'manager']), async (req: AuthRequest, res: Response) => {
  try {
    const searchCriteria: Partial<ClientData> = req.body;
    
    // Remove sales_rep_id filtering - all users can search all clients
    if (searchCriteria.sales_rep_id) {
      delete searchCriteria.sales_rep_id;
    }
    
    const clients = await Client.search(searchCriteria);
    
    res.status(200).json({ success: true, data: clients });
  } catch (error) {
    console.error('Error searching clients:', error);
    res.status(500).json({ success: false, message: 'Failed to search clients' });
  }
});

// Import clients from CSV
router.post('/import-csv', authenticate, authorize(['admin', 'manager']), upload.single('file'), async (req: AuthRequest & { file?: Express.Multer.File }, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  try {
    const results: ClientData[] = [];
    const requiredFields = ['customer_type', 'product', 'insurance_provider', 'client_name', 'mobile_no'];
    let headerValidated = false;
    let hasRequiredFields = true;
    let missingFields: string[] = [];
    const batchSize = 25; // Process 25 records at a time
    let processedCount = 0;
    let totalCount = 0;

    // Process the CSV file
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(req.file!.path)
        .pipe(csv())
        .on('headers', (headers: string[]) => {
          // Validate that the CSV has the required fields
          requiredFields.forEach(field => {
            if (!headers.includes(field)) {
              hasRequiredFields = false;
              missingFields.push(field);
            }
          });
          headerValidated = true;
        })
        .on('data', (data) => {
          totalCount++;
          const clientData: Partial<ClientData> = {};

          // Map CSV data to client data
          Object.keys(data).forEach(key => {
            // Handle numeric fields
            const numericFields = [
              'sum_insured', 'basic_premium', 'srcc_premium', 'tc_premium', 
              'net_premium', 'stamp_duty', 'admin_fees', 'road_safety_fee', 
              'policy_fee', 'vat_fee', 'total_invoice', 'commission_basic',
              'commission_srcc', 'commission_tc'
            ];
            
            // Handle date fields
            const dateFields = [
              'policy_period_from', 'policy_period_to'
            ];
            
            if (numericFields.includes(key) && data[key]) {
              // Convert to number and handle empty strings
              (clientData as any)[key] = data[key] ? parseFloat(data[key]) : 0;
            } else if (dateFields.includes(key) && data[key]) {
              // Parse dates
              try {
                const date = new Date(data[key]);
                // Check if date is valid
                if (!isNaN(date.getTime())) {
                  (clientData as any)[key] = date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
                } else {
                  (clientData as any)[key] = data[key]; // Keep original if parsing fails
                }
              } catch (err) {
                console.warn(`Error parsing date for ${key}:`, err);
                (clientData as any)[key] = data[key]; // Keep original if parsing fails
              }
            } else {
              (clientData as any)[key] = data[key];
            }
          });

          // Validate required fields for each row
          const rowMissingFields = requiredFields.filter(field => 
            !clientData[field as keyof ClientData] || 
            clientData[field as keyof ClientData] === ''
          );

          if (rowMissingFields.length === 0) {
            results.push(clientData as ClientData);
          }
        })
        .on('end', () => {
          resolve();
        })
        .on('error', (error) => {
          reject(error);
        });
    });

    // Check if headers are valid
    if (!hasRequiredFields) {
      return res.status(400).json({ 
        success: false, 
        message: `CSV is missing required fields: ${missingFields.join(', ')}` 
      });
    }

    // Send initial response to client immediately with total count
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked'
    });

    // Send initial progress
    res.write(JSON.stringify({
      success: true,
      message: `Starting import of ${results.length} clients`,
      totalCount: results.length,
      processedCount: 0,
      progress: 0,
      ids: []
    }));

    // If we have valid data, insert the clients in batches
    const createdClients: string[] = [];
    const batches = [];
    
    // Split results into batches of batchSize
    for (let i = 0; i < results.length; i += batchSize) {
      batches.push(results.slice(i, i + batchSize));
    }

    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchPromises = batch.map(clientData => Client.create(clientData));
      
      try {
        // Wait for all clients in the batch to be created
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Process batch results
        batchResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            createdClients.push(result.value);
          } else {
            console.error('Error creating client from CSV:', result.reason);
          }
        });
        
        // Update progress
        processedCount += batch.length;
        const progress = Math.round((processedCount / results.length) * 100);
        
        // Send progress update to client
        res.write(JSON.stringify({
          success: true,
          message: `Imported ${processedCount} of ${results.length} clients`,
          totalCount: results.length,
          processedCount,
          progress,
          ids: createdClients
        }));

        // Add a small delay between batches to prevent database overload
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Error processing batch:', error);
      }
    }

    // Clean up the uploaded file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Error deleting temp file:', err);
    });

    // Send final response and end the stream
    res.end(JSON.stringify({
      success: true, 
      message: `Successfully imported ${createdClients.length} clients`, 
      totalCount: results.length,
      processedCount: processedCount,
      progress: 100,
      count: createdClients.length,
      ids: createdClients
    }));

  } catch (error) {
    console.error('Error processing CSV file:', error);
    
    // Clean up the uploaded file if it exists
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    }
    
    // Check if headers have already been sent
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to process CSV file',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } else {
      // End the response with an error message
      res.end(JSON.stringify({
        success: false,
        message: 'Error during import process',
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }
});

export default router; 