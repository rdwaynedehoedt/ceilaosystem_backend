import path from 'path';
import fs from 'fs';
import db from '../config/database';

async function updateRoleConstraint() {
  try {
    console.log('Updating role constraint to include employee role...');
    const pool = await db.ensureConnection();
    
    const filePath = path.join(__dirname, 'update-role-constraint.sql');
    
    if (!fs.existsSync(filePath)) {
      console.error(`Error: SQL file ${filePath} does not exist.`);
      process.exit(1);
    }
    
    const sql = fs.readFileSync(filePath, 'utf8');
    
    try {
      await pool.request().query(sql);
      console.log('Successfully updated role constraint');
    } catch (error) {
      console.error('Error executing SQL:', error);
      throw error;
    }
    
    console.log('Role constraint update completed successfully');
  } catch (error) {
    console.error('Failed to update role constraint:', error);
    process.exit(1);
  }
}

// Execute the function if this script is run directly
if (require.main === module) {
  updateRoleConstraint();
}

export default updateRoleConstraint; 