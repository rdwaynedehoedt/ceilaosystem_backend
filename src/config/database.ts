import mssql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  server: process.env.AZURE_SQL_SERVER || '',
  database: process.env.AZURE_SQL_DATABASE || '',
  user: process.env.AZURE_SQL_USER || '',
  password: process.env.AZURE_SQL_PASSWORD || '',
  port: Number(process.env.AZURE_SQL_PORT) || 1433,
  options: {
    encrypt: true, // For Azure SQL
    trustServerCertificate: false, // Change to true for local dev / self-signed certs
    enableArithAbort: true
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
  pool: {
    max: Number(process.env.DB_POOL_MAX) || 10,
    min: Number(process.env.DB_POOL_MIN) || 0,
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT) || 30000
  }
};

// Create a global pool
const pool = new mssql.ConnectionPool(config);

// Track connection status
let isConnected = false;
let connectionError: Error | null = null;
let connectionPromise: Promise<mssql.ConnectionPool> | null = null;

// Connection pool metrics
export const getPoolStats = () => {
  // Note: accessing internal pool properties - these may change in future mssql versions
  // Using any type to bypass TypeScript's type checking for these properties
  const poolAny = pool as any;
  
  return {
    size: poolAny.pool ? poolAny.pool.size : 0,
    available: poolAny.pool ? poolAny.pool.available : 0,
    borrowed: poolAny.pool ? poolAny.pool.borrowed : 0,
    pending: poolAny.pool ? poolAny.pool.pending : 0,
    max: config.pool.max,
    min: config.pool.min,
    connected: isConnected,
    hasError: !!connectionError
  };
};

// Function to get a connection with retry
const getConnection = async (retries = 3, delay = 1000): Promise<mssql.ConnectionPool> => {
  // If we're already connected, return the pool
  if (isConnected && !connectionError) {
    return pool;
  }
  
  // If a connection is in progress, wait for it
  if (connectionPromise) {
    try {
      return await connectionPromise;
    } catch (err) {
      // If the existing promise failed, continue to retry
      connectionPromise = null;
    }
  }

  // Retry logic
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`Attempting database connection (attempt ${attempt + 1}/${retries})...`);
      
      // Create a new connection promise
      connectionPromise = pool.connect();
      
      // Wait for connection
      await connectionPromise;
      
      // If we get here, connection was successful
      isConnected = true;
      connectionError = null;
      console.log('Successfully connected to database');
      return pool;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      connectionError = lastError;
      isConnected = false;
      console.error(`Database connection attempt ${attempt + 1}/${retries} failed:`, err);
      
      // Wait before retrying
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
        // Increase delay with each retry (exponential backoff)
        delay *= 2;
      }
    }
  }

  // If we're here, all retries failed
  console.error('All database connection attempts failed');
  connectionPromise = null;
  throw lastError || new Error('Failed to connect to database after multiple attempts');
};

// Listen for connection errors
pool.on('error', err => {
  console.error('SQL Pool Error:', err);
  isConnected = false;
  connectionError = err;
  connectionPromise = null;
});

// Function to check connection health and reconnect if needed
export const ensureConnection = async (): Promise<mssql.ConnectionPool> => {
  try {
    // Try to get a connection
    const connection = await getConnection();
    
    // Test the connection with a simple query
    await connection.request().query('SELECT 1 AS ConnectionTest');
    return connection;
  } catch (err) {
    console.error('Connection health check failed:', err);
    // Force reconnection on next attempt
    isConnected = false;
    connectionError = err instanceof Error ? err : new Error(String(err));
    connectionPromise = null;
    throw err;
  }
};

// Function for keeping connection warm
export const keepConnectionWarm = async (): Promise<boolean> => {
  try {
    const connection = await ensureConnection();
    const result = await connection.request().query('SELECT 1 AS KeepAlive');
    const success = result.recordset[0].KeepAlive === 1;
    console.log(`Keep-alive ping successful: ${success}`);
    return success;
  } catch (error) {
    console.error('Keep-alive ping failed:', error);
    return false;
  }
};

// Initialize connection
console.log('Initializing database connection pool...');
// Don't block startup on initial connection
getConnection()
  .then(() => console.log('Initial database connection established'))
  .catch(err => console.error('Initial database connection failed:', err));

// Export the connection getter function instead of the raw pool
export default { 
  getConnection,
  ensureConnection
}; 