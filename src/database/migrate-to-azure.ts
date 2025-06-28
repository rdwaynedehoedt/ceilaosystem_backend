import mysql from 'mysql2/promise';
import * as mssql from 'mssql';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import db from '../config/database';
import updateSchema from './update-schema';
import { logPerformance } from '../middleware/logging';

dotenv.config();

// MySQL connection config
const mysqlConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'insurance_brokerage',
  port: Number(process.env.DB_PORT) || 3306,
};

// Azure SQL connection config
const azureSqlConfig = {
  server: process.env.AZURE_SQL_SERVER || '',
  database: process.env.AZURE_SQL_DATABASE || '',
  user: process.env.AZURE_SQL_USER || '',
  password: process.env.AZURE_SQL_PASSWORD || '',
  port: Number(process.env.AZURE_SQL_PORT) || 1433,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true
  }
};

// Function to create the schema in Azure SQL
async function createAzureSqlSchema() {
  console.log('Creating schema in Azure SQL...');
  
  try {
    // Read the schema file
    const schemaFile = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaFile, 'utf8');
    
    // Split by GO statements (T-SQL batch separator)
    const batches = schemaSql.split(/\r?\nGO\r?\n/);
    
    // Connect to Azure SQL
    const pool = await mssql.connect(azureSqlConfig);
    
    // Execute each batch
    for (const batch of batches) {
      if (batch.trim()) {
        console.log(`Executing batch: ${batch.substring(0, 100)}...`);
        await pool.request().query(batch);
      }
    }
    
    console.log('Schema created successfully');
    return pool;
  } catch (error) {
    console.error('Error creating Azure SQL schema:', error);
    throw error;
  }
}

// Function to migrate users from MySQL to Azure SQL
async function migrateUsers(mysqlPool: mysql.Pool, azurePool: mssql.ConnectionPool) {
  console.log('Migrating users...');
  
  try {
    // Get users from MySQL
    const [users]: any = await mysqlPool.query('SELECT * FROM users');
    console.log(`Found ${users.length} users to migrate`);
    
    // Insert each user into Azure SQL
    for (const user of users) {
      const request = azurePool.request();
      
      // Map MySQL boolean to SQL Server bit (0/1)
      const isActive = user.is_active ? 1 : 0;
      
      // Handle datetime fields
      const lastLogin = user.last_login ? new Date(user.last_login) : null;
      const createdAt = user.created_at ? new Date(user.created_at) : new Date();
      const updatedAt = user.updated_at ? new Date(user.updated_at) : new Date();
      
      // Add parameters
      request.input('id', mssql.Int, user.id);
      request.input('email', mssql.VarChar(255), user.email);
      request.input('password', mssql.VarChar(255), user.password);
      request.input('first_name', mssql.VarChar(100), user.first_name);
      request.input('last_name', mssql.VarChar(100), user.last_name);
      request.input('role', mssql.VarChar(20), user.role);
      request.input('phone_number', mssql.VarChar(20), user.phone_number);
      request.input('is_active', mssql.Bit, isActive);
      request.input('last_login', mssql.DateTime, lastLogin);
      request.input('created_at', mssql.DateTime, createdAt);
      request.input('updated_at', mssql.DateTime, updatedAt);
      
      // Use SET IDENTITY_INSERT to preserve IDs
      await request.query('SET IDENTITY_INSERT users ON');
      
      // Insert the user
      const query = `
        INSERT INTO users (
          id, email, password, first_name, last_name, role, 
          phone_number, is_active, last_login, created_at, updated_at
        )
        VALUES (
          @id, @email, @password, @first_name, @last_name, @role,
          @phone_number, @is_active, @last_login, @created_at, @updated_at
        )
      `;
      
      await request.query(query);
      
      // Turn off IDENTITY_INSERT
      await azurePool.request().query('SET IDENTITY_INSERT users OFF');
      
      console.log(`Migrated user: ${user.email}`);
    }
    
    console.log('Users migration completed');
  } catch (error) {
    console.error('Error migrating users:', error);
    throw error;
  }
}

// Function to migrate clients from MySQL to Azure SQL
async function migrateClients(mysqlPool: mysql.Pool, azurePool: mssql.ConnectionPool) {
  console.log('Migrating clients...');
  
  try {
    // Get clients from MySQL
    const [clients]: any = await mysqlPool.query('SELECT * FROM clients');
    console.log(`Found ${clients.length} clients to migrate`);
    
    // Insert each client into Azure SQL
    for (const client of clients) {
      const request = azurePool.request();
      
      // Convert dates
      const createdAt = client.created_at ? new Date(client.created_at) : new Date();
      const updatedAt = client.updated_at ? new Date(client.updated_at) : new Date();
      
      // Add all client fields as parameters
      Object.entries(client).forEach(([key, value]) => {
        // Skip NULL values for optional fields
        if (value !== null) {
          request.input(key, value);
        }
      });
      
      // Override date fields with proper Date objects
      request.input('created_at', mssql.DateTime, createdAt);
      request.input('updated_at', mssql.DateTime, updatedAt);
      
      // Generate column names and parameter names for the query
      const columnNames = Object.keys(client).filter(key => client[key] !== null).join(', ');
      const paramNames = Object.keys(client).filter(key => client[key] !== null).map(key => `@${key}`).join(', ');
      
      // Insert the client
      const query = `INSERT INTO clients (${columnNames}) VALUES (${paramNames})`;
      await request.query(query);
      
      console.log(`Migrated client: ${client.id} - ${client.client_name}`);
    }
    
    console.log('Clients migration completed');
  } catch (error) {
    console.error('Error migrating clients:', error);
    throw error;
  }
}

// Main migration function
async function migrateDatabase() {
  console.log('Starting database migration to Azure SQL...');
  
  let mysqlPool: mysql.Pool | null = null;
  let azurePool: mssql.ConnectionPool | null = null;
  
  try {
    // Create connections
    mysqlPool = mysql.createPool(mysqlConfig);
    console.log('Connected to MySQL source database');
    
    // Create schema in Azure SQL
    azurePool = await createAzureSqlSchema();
    console.log('Connected to Azure SQL destination database');
    
    // Migrate data
    await migrateUsers(mysqlPool, azurePool);
    await migrateClients(mysqlPool, azurePool);
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Close connections
    if (mysqlPool) {
      await mysqlPool.end();
      console.log('MySQL connection closed');
    }
    
    if (azurePool) {
      await azurePool.close();
      console.log('Azure SQL connection closed');
    }
  }
}

// Execute the migration
migrateDatabase().catch(err => {
  console.error('Unhandled error during migration:', err);
  process.exit(1);
});

/**
 * This script applies performance optimizations to the Azure SQL database
 * for improved login performance and general system responsiveness.
 */
async function applyPerformanceOptimizations() {
  console.log('Starting performance optimization process...');
  const startTime = process.hrtime();
  
  try {
    // Get connection from pool
    const pool = await db.ensureConnection();
    
    // 1. Apply schema updates including the email index
    console.log('Applying schema updates...');
    await updateSchema();
    
    // 2. Check and optimize existing indexes
    console.log('Checking database indexes...');
    const indexStats = await pool.request().query(`
      SELECT 
        OBJECT_NAME(i.object_id) AS TableName,
        i.name AS IndexName,
        i.type_desc AS IndexType,
        STATS_DATE(i.object_id, i.index_id) AS LastUpdated
      FROM sys.indexes i
      INNER JOIN sys.objects o ON i.object_id = o.object_id
      WHERE o.type = 'U' -- User tables only
      ORDER BY OBJECT_NAME(i.object_id), i.index_id;
    `);
    
    console.log(`Found ${indexStats.recordset.length} indexes in the database`);
    
    // 3. Update statistics for better query performance
    console.log('Updating statistics for better query optimization...');
    await pool.request().query(`
      EXEC sp_updatestats;
    `);
    
    // 4. Check for missing indexes that might benefit login performance
    console.log('Checking for missing indexes...');
    const missingIndexes = await pool.request().query(`
      SELECT TOP 5
        CONVERT (varchar, getdate(), 126) AS runtime,
        migs.avg_total_user_cost * (migs.avg_user_impact / 100.0) * (migs.user_seeks + migs.user_scans) AS improvement_measure,
        'CREATE INDEX missing_index_' + CONVERT (varchar, mig.index_group_handle) + '_' + CONVERT (varchar, mid.index_handle)
        + ' ON ' + mid.statement
        + ' (' + ISNULL (mid.equality_columns,'')
        + CASE WHEN mid.equality_columns IS NOT NULL AND mid.inequality_columns IS NOT NULL THEN ',' ELSE '' END
        + ISNULL (mid.inequality_columns, '')
        + ')'
        + ISNULL (' INCLUDE (' + mid.included_columns + ')', '') AS create_index_statement,
        migs.user_seeks,
        migs.user_scans,
        migs.last_user_seek,
        migs.avg_total_user_cost,
        migs.avg_user_impact
      FROM sys.dm_db_missing_index_groups mig
      INNER JOIN sys.dm_db_missing_index_group_stats migs ON migs.group_handle = mig.index_group_handle
      INNER JOIN sys.dm_db_missing_index_details mid ON mig.index_handle = mid.index_handle
      ORDER BY migs.avg_total_user_cost * migs.avg_user_impact * (migs.user_seeks + migs.user_scans) DESC;
    `);
    
    if (missingIndexes.recordset.length > 0) {
      console.log('Suggested missing indexes:');
      missingIndexes.recordset.forEach((idx: any, i: number) => {
        console.log(`${i + 1}. ${idx.create_index_statement}`);
        console.log(`   Potential improvement: ${idx.improvement_measure.toFixed(2)}`);
        console.log(`   User seeks: ${idx.user_seeks}, User scans: ${idx.user_scans}`);
        console.log('---');
      });
    } else {
      console.log('No missing indexes detected.');
    }
    
    // 5. Check for unused indexes that might be slowing down inserts/updates
    console.log('Checking for unused indexes...');
    const unusedIndexes = await pool.request().query(`
      SELECT 
        OBJECT_NAME(i.object_id) AS TableName,
        i.name AS IndexName,
        i.type_desc AS IndexType,
        s.user_seeks,
        s.user_scans,
        s.user_lookups,
        s.user_updates
      FROM sys.indexes i
      INNER JOIN sys.objects o ON i.object_id = o.object_id
      LEFT JOIN sys.dm_db_index_usage_stats s ON i.object_id = s.object_id AND i.index_id = s.index_id
      WHERE o.type = 'U' -- User tables only
        AND i.is_primary_key = 0 -- Not primary key
        AND i.is_unique = 0 -- Not unique constraint
        AND (s.user_seeks = 0 OR s.user_seeks IS NULL)
        AND (s.user_scans = 0 OR s.user_scans IS NULL)
        AND (s.user_lookups = 0 OR s.user_lookups IS NULL)
      ORDER BY ISNULL(s.user_updates, 0) DESC;
    `);
    
    if (unusedIndexes.recordset.length > 0) {
      console.log('Potentially unused indexes:');
      unusedIndexes.recordset.forEach((idx: any, i: number) => {
        console.log(`${i + 1}. ${idx.TableName}.${idx.IndexName} (${idx.IndexType})`);
        console.log(`   Seeks: ${idx.user_seeks || 0}, Scans: ${idx.user_scans || 0}, Lookups: ${idx.user_lookups || 0}, Updates: ${idx.user_updates || 0}`);
      });
    } else {
      console.log('No unused indexes detected.');
    }
    
    const endTime = process.hrtime(startTime);
    const duration = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);
    
    console.log(`Performance optimization completed in ${duration}ms`);
    
    logPerformance('database_optimization', {
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      indexes_found: indexStats.recordset.length,
      missing_indexes: missingIndexes.recordset.length,
      unused_indexes: unusedIndexes.recordset.length
    });
    
    return true;
  } catch (error) {
    console.error('Error during performance optimization:', error);
    return false;
  }
}

// Run the optimization if this script is executed directly
if (require.main === module) {
  applyPerformanceOptimizations()
    .then(success => {
      if (success) {
        console.log('Performance optimization completed successfully.');
        process.exit(0);
      } else {
        console.error('Performance optimization failed.');
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Unexpected error:', err);
      process.exit(1);
    });
}

export default applyPerformanceOptimizations; 