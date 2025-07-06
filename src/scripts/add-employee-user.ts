import path from 'path';
import fs from 'fs';
import db from '../config/database';
import { hashPassword } from '../utils/auth';

async function addEmployeeUser() {
  try {
    console.log('Adding employee user to database...');
    const pool = await db.ensureConnection();
    
    // Generate a proper bcrypt hash for the password
    const password = 'Emp@123';
    const hashedPassword = await hashPassword(password);
    
    console.log('Checking if user already exists...');
    const checkResult = await pool.request()
      .input('email', 'employee@example.com')
      .query('SELECT COUNT(*) as count FROM users WHERE email = @email');
    
    if (checkResult.recordset[0].count > 0) {
      console.log('User with email employee@example.com already exists');
      return;
    }
    
    console.log('Inserting new employee user...');
    await pool.request()
      .input('email', 'employee@example.com')
      .input('password', hashedPassword)
      .input('firstName', 'Employee')
      .input('lastName', 'User')
      .input('role', 'employee')
      .input('phoneNumber', '1234567890')
      .query(`
        INSERT INTO users (
          email, 
          password, 
          first_name, 
          last_name, 
          role, 
          phone_number, 
          is_active, 
          created_at, 
          updated_at
        )
        VALUES (
          @email,
          @password,
          @firstName,
          @lastName,
          @role,
          @phoneNumber,
          1,
          GETDATE(),
          GETDATE()
        );
      `);
    
    console.log('Employee user added successfully');
  } catch (error) {
    console.error('Failed to add employee user:', error);
    process.exit(1);
  }
}

// Execute the function if this script is run directly
if (require.main === module) {
  addEmployeeUser();
}

export default addEmployeeUser; 