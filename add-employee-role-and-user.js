// Script to add employee role and user
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Adding Employee Role and User ===\n');

// Step 1: Create the SQL file directly in the scripts directory
console.log('1. Creating SQL script file...');
const sqlContent = `
-- Script to update the role constraint to include 'employee'

-- First, identify the constraint name
DECLARE @ConstraintName NVARCHAR(128);
SELECT @ConstraintName = name
FROM sys.check_constraints
WHERE OBJECT_NAME(parent_object_id) = 'users' AND name LIKE 'CK%role%';

-- Output the constraint name for debugging
PRINT 'Found constraint: ' + ISNULL(@ConstraintName, 'No constraint found');

-- If constraint exists, drop it and recreate with employee role
IF @ConstraintName IS NOT NULL
BEGIN
    -- Create dynamic SQL to drop the constraint
    DECLARE @DropSQL NVARCHAR(MAX);
    SET @DropSQL = 'ALTER TABLE users DROP CONSTRAINT ' + @ConstraintName;
    
    -- Execute the drop statement
    EXEC sp_executesql @DropSQL;
    PRINT 'Dropped constraint: ' + @ConstraintName;
    
    -- Add new constraint that includes employee role
    ALTER TABLE users ADD CONSTRAINT CK_users_role 
    CHECK (role IN ('admin', 'manager', 'underwriter', 'sales', 'employee'));
    
    PRINT 'Added new constraint with employee role';
END
ELSE
BEGIN
    PRINT 'No constraint found, adding new constraint';
    
    -- Add new constraint that includes employee role
    ALTER TABLE users ADD CONSTRAINT CK_users_role 
    CHECK (role IN ('admin', 'manager', 'underwriter', 'sales', 'employee'));
    
    PRINT 'Added new constraint with employee role';
END

-- Now add the employee user
IF NOT EXISTS (SELECT * FROM users WHERE email = 'employee@example.com')
BEGIN
    -- Insert the employee user with a placeholder password (will be updated by the script)
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
        'employee@example.com',
        'PLACEHOLDER_TO_BE_UPDATED',
        'Employee',
        'User',
        'employee',
        '1234567890',
        1,
        GETDATE(),
        GETDATE()
    );
    
    PRINT 'Employee user added successfully';
END
ELSE
BEGIN
    PRINT 'User with email employee@example.com already exists';
END
`;

const sqlFilePath = path.join(__dirname, 'src', 'scripts', 'add-employee-role-and-user.sql');
fs.writeFileSync(sqlFilePath, sqlContent, 'utf8');
console.log(`✅ SQL script created at ${sqlFilePath}`);

// Step 2: Create the TypeScript file to execute the SQL
console.log('\n2. Creating TypeScript executor...');
const tsContent = `
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
      console.error(\`Error: SQL file \${filePath} does not exist.\`);
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
`;

const tsFilePath = path.join(__dirname, 'src', 'scripts', 'add-employee-role-and-user.ts');
fs.writeFileSync(tsFilePath, tsContent, 'utf8');
console.log(`✅ TypeScript executor created at ${tsFilePath}`);

// Step 3: Run the script
console.log('\n3. Running the script...');
try {
  execSync('npx ts-node src/scripts/add-employee-role-and-user.ts', { stdio: 'inherit' });
  console.log('\n✅ Employee role and user added successfully');
  console.log('\nEmployee user details:');
  console.log('- Email: employee@example.com');
  console.log('- Password: Emp@123');
  console.log('- Role: employee');
} catch (error) {
  console.error('\n❌ Failed to add employee role and user:', error);
  process.exit(1);
} 