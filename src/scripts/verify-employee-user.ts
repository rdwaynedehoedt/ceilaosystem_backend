import db from '../config/database';

async function verifyEmployeeUser() {
  try {
    console.log('Verifying employee user in database...');
    const pool = await db.ensureConnection();
    
    const result = await pool.request()
      .query(`
        SELECT id, email, first_name, last_name, role
        FROM users
        WHERE email = 'employee@example.com'
      `);
    
    if (result.recordset.length > 0) {
      const user = result.recordset[0];
      console.log('✅ Employee user found in database:');
      console.log(`- ID: ${user.id}`);
      console.log(`- Email: ${user.email}`);
      console.log(`- Name: ${user.first_name} ${user.last_name}`);
      console.log(`- Role: ${user.role}`);
    } else {
      console.log('❌ Employee user not found in database');
    }
  } catch (error) {
    console.error('Error verifying employee user:', error);
    process.exit(1);
  }
}

// Execute the function if this script is run directly
if (require.main === module) {
  verifyEmployeeUser();
}

export default verifyEmployeeUser; 