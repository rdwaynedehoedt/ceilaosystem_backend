const sql = require('mssql');
require('dotenv').config();

async function runMigration() {
  try {
    console.log('Starting database migration...');
    
    // Database configuration - using the same env vars as the main app
    const config = {
      server: process.env.AZURE_SQL_SERVER,
      database: process.env.AZURE_SQL_DATABASE,
      user: process.env.AZURE_SQL_USER,
      password: process.env.AZURE_SQL_PASSWORD,
      port: Number(process.env.AZURE_SQL_PORT) || 1433,
      options: {
        encrypt: true, // For Azure SQL
        trustServerCertificate: false,
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
    
    console.log('Database config:', {
      server: config.server,
      database: config.database,
      user: config.user,
      port: config.port
    });
    
    if (!config.server || !config.database || !config.user || !config.password) {
      throw new Error('Missing required database environment variables. Please check AZURE_SQL_SERVER, AZURE_SQL_DATABASE, AZURE_SQL_USER, and AZURE_SQL_PASSWORD.');
    }
    
    console.log('Connecting to database...');
    const pool = await sql.connect(config);
    console.log('Connected to database successfully');
    
    // Add new fields
    const newFields = [
      'ceilao_ib_file_no VARCHAR(100)',
      'policyholder VARCHAR(255)',
      'vehicle_number VARCHAR(50)',
      'main_class VARCHAR(100)',
      'proposal_form_doc VARCHAR(255)',
      'proposal_form_field VARCHAR(255)',
      'quotation_doc VARCHAR(255)',
      'quotation_field VARCHAR(255)',
      'schedule_doc VARCHAR(255)',
      'cr_copy_doc VARCHAR(255)',
      'invoice_debit_note_doc VARCHAR(255)',
      'invoice_debit_note_field VARCHAR(255)',
      'payment_receipt_doc VARCHAR(255)',
      'payment_receipt_field VARCHAR(255)',
      'nic_br_doc VARCHAR(255)'
    ];
    
    for (const field of newFields) {
      try {
        const fieldName = field.split(' ')[0];
        const query = `
          IF NOT EXISTS (
            SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = '${fieldName}'
          )
          BEGIN
            ALTER TABLE clients ADD ${field}
          END
        `;
        
        await pool.request().query(query);
        console.log(`✓ Added field: ${fieldName}`);
      } catch (error) {
        console.log(`⚠ Field ${field.split(' ')[0]} might already exist or error occurred:`, error.message);
      }
    }
    
    // Add indexes
    const indexes = [
      'idx_ceilao_ib_file_no',
      'idx_policyholder', 
      'idx_vehicle_number'
    ];
    
    for (const indexName of indexes) {
      try {
        const fieldName = indexName.replace('idx_', '');
        const query = `
          IF NOT EXISTS (
            SELECT * FROM sys.indexes 
            WHERE name = '${indexName}' AND object_id = OBJECT_ID('clients')
          )
          BEGIN
            CREATE INDEX ${indexName} ON clients(${fieldName})
          END
        `;
        
        await pool.request().query(query);
        console.log(`✓ Added index: ${indexName}`);
      } catch (error) {
        console.log(`⚠ Index ${indexName} might already exist or error occurred:`, error.message);
      }
    }
    
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    if (typeof pool !== 'undefined' && pool) {
      await pool.close();
    }
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration }; 