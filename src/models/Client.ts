import db from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export interface ClientData {
  id?: string;
  introducer_code?: string;
  customer_type: string;
  product: string;
  policy_?: string;
  insurance_provider: string;
  branch?: string;
  client_name: string;
  street1?: string;
  street2?: string;
  city?: string;
  district?: string;
  province?: string;
  telephone?: string;
  mobile_no: string;
  contact_person?: string;
  email?: string;
  social_media?: string;
  nic_proof?: string;
  dob_proof?: string;
  business_registration?: string;
  svat_proof?: string;
  vat_proof?: string;
  coverage_proof?: string;
  sum_insured_proof?: string;
  policy_fee_invoice?: string;
  vat_fee_debit_note?: string;
  payment_receipt_proof?: string;
  policy_type?: string;
  policy_no?: string;
  policy_period_from?: string;
  policy_period_to?: string;
  coverage?: string;
  sum_insured?: number;
  basic_premium?: number;
  srcc_premium?: number;
  tc_premium?: number;
  net_premium?: number;
  stamp_duty?: number;
  admin_fees?: number;
  road_safety_fee?: number;
  policy_fee?: number;
  vat_fee?: number;
  total_invoice?: number;
  debit_note?: string;
  payment_receipt?: string;
  commission_type?: string;
  commission_basic?: number;
  commission_srcc?: number;
  commission_tc?: number;
  sales_rep_id?: number;
  policies?: number;
}

export class Client {
  // Create a new client
  static async create(data: ClientData): Promise<string> {
    try {
      // Get a database connection with retry mechanism
      const pool = await db.ensureConnection();
      const clientId = data.id || `C${uuidv4().substring(0, 8)}`;
      
      // Create a clean copy of data without undefined values and remove the id field
      const cleanData: any = {};
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id') {
          cleanData[key] = value;
        }
      });
      
      // Generate fields for the SQL query
      const fields = Object.keys(cleanData).join(', ');
      
      // Generate parameter placeholders for SQL Server (@p1, @p2, etc.)
      const paramNames = Object.keys(cleanData).map((_, i) => `@p${i + 2}`).join(', ');
      const paramMap = Object.keys(cleanData).reduce((acc, key, i) => {
        acc[`p${i + 2}`] = cleanData[key];
        return acc;
      }, {} as Record<string, any>);
      
      // Add clientId parameter
      paramMap.p1 = clientId;
      
      // Create a new request with retry logic
      let retries = 3;
      let lastError: Error | null = null;
      
      while (retries > 0) {
        try {
          const request = pool.request();
          
          // Add all parameters to the request
          Object.entries(paramMap).forEach(([key, value]) => {
            request.input(key, value);
          });
          
          const query = `
            INSERT INTO clients (id, ${fields}) 
            VALUES (@p1, ${paramNames})
          `;
          
          await request.query(query);
          
          // If successful, return the client ID
          return clientId;
        } catch (err) {
          console.error(`Error creating client (retries left: ${retries - 1}):`, err);
          lastError = err instanceof Error ? err : new Error(String(err));
          
          // Detect specific SQL error types that might be transient
          const isTransientError = 
            (err instanceof Error && 
             (err.message.includes('timeout') || 
              err.message.includes('connection') || 
              err.message.includes('deadlock')));
          
          if (isTransientError) {
            // Only retry for transient errors
            retries--;
            if (retries > 0) {
              // Wait before retrying with exponential backoff
              const delay = Math.pow(2, 3 - retries) * 100; // 100ms, 200ms, 400ms
              await new Promise(resolve => setTimeout(resolve, delay));
              // Re-establish connection if needed
              await db.ensureConnection();
              continue;
            }
          } else {
            // For non-transient errors, don't retry
            retries = 0;
          }
        }
      }
      
      // If we get here, all retries failed
      if (lastError) {
        throw lastError;
      }
      
      // Fallback return in case something unexpected happened
      return clientId;
    } catch (error) {
      console.error('Error creating client:', error);
      throw error;
    }
  }
  
  // Get a client by ID
  static async getById(id: string): Promise<ClientData | null> {
    try {
      // Get a database connection with retry mechanism
      const pool = await db.getConnection();
      const request = pool.request();
      request.input('id', id);
      
      const result = await request.query('SELECT * FROM clients WHERE id = @id');
      
      if (result.recordset.length === 0) {
        return null;
      }
      
      return result.recordset[0];
    } catch (error) {
      console.error('Error getting client by ID:', error);
      throw error;
    }
  }
  
  // Get all clients
  static async getAll(limit: number = 100, offset: number = 0): Promise<ClientData[]> {
    try {
      // Get a database connection with retry mechanism
      const pool = await db.getConnection();
      const request = pool.request();
      request.input('limit', limit);
      request.input('offset', offset);
      
      // T-SQL doesn't support LIMIT/OFFSET directly, we need to use ORDER BY with OFFSET-FETCH
      const result = await request.query(`
        SELECT * FROM clients 
        ORDER BY created_at DESC 
        OFFSET @offset ROWS 
        FETCH NEXT @limit ROWS ONLY
      `);
      
      return result.recordset;
    } catch (error) {
      console.error('Error getting all clients:', error);
      throw error;
    }
  }
  
  // Get the total count of clients in the database
  static async getTotalCount(): Promise<number> {
    try {
      // Get a database connection
      const pool = await db.getConnection();
      const request = pool.request();
      
      const result = await request.query('SELECT COUNT(*) as count FROM clients');
      
      return result.recordset[0].count;
    } catch (error) {
      console.error('Error getting client count:', error);
      throw error;
    }
  }
  
  // Search clients with pagination support
  static async searchWithPagination(searchTerm: string, limit: number = 100, offset: number = 0): Promise<ClientData[]> {
    try {
      // Get a database connection
      const pool = await db.getConnection();
      const request = pool.request();
      
      // Sanitize the search term
      const searchPattern = `%${searchTerm.replace(/[%_[\]]/g, '\\$&')}%`;
      
      request.input('searchPattern', searchPattern);
      request.input('limit', limit);
      request.input('offset', offset);
      
      const result = await request.query(`
        SELECT * FROM clients 
        WHERE client_name LIKE @searchPattern 
        OR mobile_no LIKE @searchPattern
        ORDER BY created_at DESC 
        OFFSET @offset ROWS 
        FETCH NEXT @limit ROWS ONLY
      `);
      
      return result.recordset;
    } catch (error) {
      console.error('Error searching clients with pagination:', error);
      throw error;
    }
  }
  
  // Get the total count of search results
  static async getSearchResultCount(searchTerm: string): Promise<number> {
    try {
      // Get a database connection
      const pool = await db.getConnection();
      const request = pool.request();
      
      // Sanitize the search term
      const searchPattern = `%${searchTerm.replace(/[%_[\]]/g, '\\$&')}%`;
      
      request.input('searchPattern', searchPattern);
      
      const result = await request.query(`
        SELECT COUNT(*) as count FROM clients 
        WHERE client_name LIKE @searchPattern 
        OR mobile_no LIKE @searchPattern
      `);
      
      return result.recordset[0].count;
    } catch (error) {
      console.error('Error getting search result count:', error);
      throw error;
    }
  }
  
  // Update a client
  static async update(id: string, data: Partial<ClientData>): Promise<boolean> {
    try {
      console.log('Client.update called with ID:', id);
      
      // Create a clean copy of data without undefined values
      const cleanData: any = {};
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          cleanData[key] = value;
        }
      });
      
      if (Object.keys(cleanData).length === 0) {
        // No fields to update
        console.log('No fields to update for client:', id);
        return true;
      }
      
      // Remove updated_at if it exists in the input data
      // We will set it ourselves in the query
      if ('updated_at' in cleanData) {
        delete cleanData.updated_at;
        console.log('Removed updated_at from input data, it will be set by the query');
      }
      
      console.log('Getting database connection...');
      // Get a database connection with retry mechanism
      const pool = await db.ensureConnection();
      console.log('Database connection acquired successfully');
      const request = pool.request();
      
      // Create SET clause for SQL and add parameters
      const setClause = Object.keys(cleanData)
        .map((key, index) => {
          const paramName = `p${index}`;
          // Check for invalid column names or reserved SQL keywords
          const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '');
          
          // Add better error handling for parameter input
          try {
            request.input(paramName, cleanData[key]);
          } catch (err) {
            console.error(`Error adding parameter ${paramName} with value:`, cleanData[key]);
            console.error('Parameter error:', err);
            // Use a fallback empty string for problematic values
            request.input(paramName, '');
          }
          
          return `${safeKey} = @${paramName}`;
        })
        .join(', ');
      
      // Add id parameter
      request.input('id', id);
      
      // Don't add updated_at in the SET clause as it's specified manually
      const query = `UPDATE clients SET ${setClause}, updated_at = GETDATE() WHERE id = @id`;
      console.log('Update query:', query);
      console.log('Update parameters:', JSON.stringify(cleanData, null, 2));
      
      const result = await request.query(query);
      console.log('Update result:', JSON.stringify(result, null, 2));
      
      return result.rowsAffected[0] > 0;
    } catch (error) {
      console.error('Error updating client:', error);
      // Show more details about the error
      if (error instanceof Error) {
        console.error('Error details:', error.message);
        if ('code' in error) {
          console.error('SQL error code:', (error as any).code);
        }
        if ('number' in error) {
          console.error('SQL error number:', (error as any).number);
        }
      }
      throw error;
    }
  }
  
  // Delete a client
  static async delete(id: string): Promise<boolean> {
    try {
      // Get a database connection with retry mechanism
      const pool = await db.getConnection();
      const request = pool.request();
      request.input('id', id);
      
      const result = await request.query('DELETE FROM clients WHERE id = @id');
      return result.rowsAffected[0] > 0;
    } catch (error) {
      console.error('Error deleting client:', error);
      throw error;
    }
  }
  
  // Search clients by various criteria
  static async search(criteria: Partial<ClientData>): Promise<ClientData[]> {
    try {
      // Get a database connection with retry mechanism
      const pool = await db.getConnection();
      const request = pool.request();
      
      // Build WHERE clauses
      const whereClauses: string[] = [];
      let paramIndex = 0;
      
      Object.entries(criteria).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          const paramName = `p${paramIndex++}`;
          const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '');
          
          if (typeof value === 'string') {
            // For string values, use LIKE for partial matching
            whereClauses.push(`${safeKey} LIKE @${paramName}`);
            request.input(paramName, `%${value}%`);
          } else {
            // For other types (number, boolean), use exact matching
            whereClauses.push(`${safeKey} = @${paramName}`);
            request.input(paramName, value);
          }
        }
      });
      
      const whereClause = whereClauses.length > 0 
        ? `WHERE ${whereClauses.join(' AND ')}`
        : '';
      
      const query = `
        SELECT * FROM clients 
        ${whereClause}
        ORDER BY created_at DESC
      `;
      
      const result = await request.query(query);
      return result.recordset;
    } catch (error) {
      console.error('Error searching clients:', error);
      throw error;
    }
  }
  
  // Get clients by sales rep
  static async getBySalesRep(salesRepId: number): Promise<ClientData[]> {
    try {
      // Get a database connection with retry mechanism
      const pool = await db.getConnection();
      const request = pool.request();
      request.input('salesRepId', salesRepId);
      
      const result = await request.query(`
        SELECT * FROM clients 
        WHERE sales_rep_id = @salesRepId
        ORDER BY created_at DESC
      `);
      
      return result.recordset;
    } catch (error) {
      console.error(`Error getting clients for sales rep ${salesRepId}:`, error);
      throw error;
    }
  }
} 