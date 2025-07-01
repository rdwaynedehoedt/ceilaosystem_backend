const db = require('./src/config/database').default;

async function runMigration() {
  try {
    console.log('Starting database migration...');
    
    const pool = await db.ensureConnection();
    const request = pool.request();
    
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
        await request.query(`
          IF NOT EXISTS (
            SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = '${fieldName}'
          )
          BEGIN
            ALTER TABLE clients ADD ${field}
          END
        `);
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
        await request.query(`
          IF NOT EXISTS (
            SELECT * FROM sys.indexes 
            WHERE name = '${indexName}' AND object_id = OBJECT_ID('clients')
          )
          BEGIN
            CREATE INDEX ${indexName} ON clients(${fieldName})
          END
        `);
        console.log(`✓ Added index: ${indexName}`);
      } catch (error) {
        console.log(`⚠ Index ${indexName} might already exist or error occurred:`, error.message);
      }
    }
    
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
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