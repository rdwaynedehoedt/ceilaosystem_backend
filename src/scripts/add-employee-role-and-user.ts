
import path from 'path';
import fs from 'fs';
import db from '../config/database';
import { hashPassword } from '../utils/auth';

async function addEmployeeRoleAndUser() {
  try {
    console.log('Updating role constraint and adding employee user...');
    const pool = await db.ensureConnection();
    
    // Execute the SQL file first
    const filePath = path.join(__dirname, 'add-employee-role-and-user.sql');
    
    if (!fs.existsSync(filePath)) {
      console.error(`Error: SQL file ${filePath} does not exist.`);
      process.exit(1);
    }
    
    const sql = fs.readFileSync(filePath, 'utf8');
    
    try {
      await pool.request().query(sql);
      console.log('Successfully executed initial SQL');
    } catch (error) {
      console.error('Error executing SQL:', error);
      throw error;
    }
    
    // Now update the password with a proper hash
    const password = 'Emp@123';
    const hashedPassword = await hashPassword(password);
    
    await pool.request()
      .input('password', hashedPassword)
      .input('email', 'employee@example.com')
      .query('UPDATE users SET password = @password WHERE email = @email');
    
    console.log('Employee user password updated with secure hash');
    console.log('Employee role and user setup completed successfully');
  } catch (error) {
    console.error('Failed to add employee role and user:', error);
    process.exit(1);
  }
}

// Execute the function if this script is run directly
if (require.main === module) {
  addEmployeeRoleAndUser();
}

export default addEmployeeRoleAndUser;
