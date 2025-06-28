import fs from 'fs';
import path from 'path';
import db from '../config/database';

async function updateSchema() {
  try {
    console.log('Starting database schema update...');
    const startTime = process.hrtime();
    
    // Get connection from pool
    const pool = await db.ensureConnection();
    
    // Read and execute the schema update SQL
    const schemaUpdatePath = path.join(__dirname, 'alter-clients.sql');
    const schemaUpdateSql = fs.readFileSync(schemaUpdatePath, 'utf8');
    
    console.log('Executing schema update SQL...');
    await pool.request().batch(schemaUpdateSql);
    
    // Add performance optimizations
    console.log('Applying performance optimizations...');
    
    // Check if email index exists on users table
    const indexCheckResult = await pool.request().query(`
      SELECT COUNT(*) as count
      FROM sys.indexes 
      WHERE name = 'idx_users_email' AND object_id = OBJECT_ID('users')
    `);
    
    const indexExists = indexCheckResult.recordset[0].count > 0;
    
    if (!indexExists) {
      console.log('Creating index on users.email for faster login queries...');
      await pool.request().query(`
        CREATE INDEX idx_users_email ON users(email);
      `);
      console.log('Email index created successfully.');
    } else {
      console.log('Email index already exists.');
    }
    
    const endTime = process.hrtime(startTime);
    const duration = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);
    
    console.log(`Schema update completed successfully in ${duration}ms.`);
    
    // No need to close the connection when using the pool
    console.log('Database connection will be returned to the pool');
    
    return true;
  } catch (error) {
    console.error('Error updating schema:', error);
    return false;
  }
}

// Run the update if this script is executed directly
if (require.main === module) {
  updateSchema()
    .then(success => {
      if (success) {
        console.log('Schema update completed.');
      } else {
        console.error('Schema update failed.');
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Unexpected error:', err);
      process.exit(1);
    });
}

export default updateSchema; 