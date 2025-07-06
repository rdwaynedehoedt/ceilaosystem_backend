import path from 'path';
import fs from 'fs';
import db from '../config/database';

async function updateSchema(): Promise<boolean> {
  try {
    console.log('Starting schema update...');
    const pool = await db.ensureConnection();
    
    // List of SQL files to execute in order
    const sqlFiles = [
      'schema.sql',
      'add-employee-role.sql'
    ];
    
    for (const file of sqlFiles) {
      console.log(`Executing ${file}...`);
      const filePath = path.join(__dirname, file);
      
      if (!fs.existsSync(filePath)) {
        console.warn(`Warning: File ${filePath} does not exist, skipping.`);
        continue;
      }
      
      const sql = fs.readFileSync(filePath, 'utf8');
      
      try {
        await pool.request().query(sql);
        console.log(`Successfully executed ${file}`);
      } catch (error) {
        console.error(`Error executing ${file}:`, error);
        throw error;
      }
    }
    
    console.log('Schema update completed successfully');
    return true;
  } catch (error) {
    console.error('Failed to update schema:', error);
    return false;
  }
}

// Execute the function if this script is run directly
if (require.main === module) {
  updateSchema()
    .then(success => {
      if (!success) {
        process.exit(1);
      }
    })
    .catch(() => process.exit(1));
}

// Export the function for use in other scripts
export default updateSchema; 