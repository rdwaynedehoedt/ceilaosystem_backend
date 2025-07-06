import path from 'path';
import fs from 'fs';
import db from '../config/database';

async function addEmployeeRole() {
  try {
    console.log('Adding employee role to users table...');
    const pool = await db.ensureConnection();
    
    const filePath = path.join(__dirname, '..', 'database', 'add-employee-role.sql');
    
    if (!fs.existsSync(filePath)) {
      console.error(`Error: Migration file ${filePath} does not exist.`);
      process.exit(1);
    }
    
    const sql = fs.readFileSync(filePath, 'utf8');
    
    try {
      await pool.request().query(sql);
      console.log('Successfully added employee role to users table');
    } catch (error) {
      console.error('Error executing SQL:', error);
      throw error;
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Failed to run migration:', error);
    process.exit(1);
  }
}

// Execute the function if this script is run directly
if (require.main === module) {
  addEmployeeRole();
}

export default addEmployeeRole; 