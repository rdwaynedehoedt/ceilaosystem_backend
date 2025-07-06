// Script to add an employee user to the database
const { execSync } = require('child_process');

console.log('Adding employee user to the database...');

try {
  execSync('npx ts-node src/scripts/add-employee-user.ts', { stdio: 'inherit' });
  console.log('✅ Employee user added successfully');
  console.log('\nEmployee user details:');
  console.log('- Email: employee@example.com');
  console.log('- Password: Emp@123');
  console.log('- Role: employee');
} catch (error) {
  console.error('❌ Failed to add employee user:', error);
  process.exit(1);
} 