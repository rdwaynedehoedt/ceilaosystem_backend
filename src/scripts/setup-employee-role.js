// Script to set up the employee role
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('Setting up employee role...');

// Step 1: Run the migration to add the employee role to the database
console.log('\n1. Running database migration...');
try {
  execSync('npx ts-node src/scripts/add-employee-role.ts', { stdio: 'inherit' });
  console.log('✅ Database migration completed successfully');
} catch (error) {
  console.error('❌ Database migration failed:', error);
  process.exit(1);
}

// Step 2: Create a sample employee user
console.log('\n2. You can now create an employee user through the admin dashboard');
console.log('   or by using the following API endpoint:');
console.log('   POST /api/auth/users');
console.log('   With the following JSON body:');
console.log(`   {
     "email": "employee@example.com",
     "password": "Emp@123",
     "firstName": "Employee",
     "lastName": "User",
     "role": "employee"
   }`);

console.log('\n✅ Employee role setup completed successfully');
console.log('\nNotes:');
console.log('- Employees can access the manager dashboard');
console.log('- Employees can view and add clients');
console.log('- Employees CANNOT edit or delete clients');
console.log('- Employees CANNOT generate reports or import/export CSV files'); 