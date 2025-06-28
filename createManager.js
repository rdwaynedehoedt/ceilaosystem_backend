const sql = require('mssql');
const bcrypt = require('bcryptjs');

const config = {
  server: 'insurance-brokerage-sqlserver.database.windows.net',
  user: 'adminuser',
  password: 'Admin123',
  database: 'insurance_brokerage_db',
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

async function createManagerUser() {
  try {
    console.log('Connecting to database...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Manager@123', salt);
    
    const pool = await sql.connect(config);
    console.log('Connected to database.');
    
    // Check if user already exists
    const checkResult = await pool.request()
      .input('email', 'manager@insurance-brokerage.com')
      .query('SELECT id FROM users WHERE email = @email');
    
    if (checkResult.recordset.length > 0) {
      console.log('Manager user already exists with ID:', checkResult.recordset[0].id);
      
      // Update status to active if it exists
      await pool.request()
        .input('email', 'manager@insurance-brokerage.com')
        .query('UPDATE users SET status = \'active\' WHERE email = @email');
      
      console.log('Updated status to active.');
    } else {
      // Create new user
      const result = await pool.request()
        .input('email', 'manager@insurance-brokerage.com')
        .input('password', hashedPassword)
        .input('firstName', 'John')
        .input('lastName', 'Manager')
        .input('role', 'manager')
        .input('status', 'active')
        .query(`
          INSERT INTO users (email, password, first_name, last_name, role, status)
          VALUES (@email, @password, @firstName, @lastName, @role, @status);
          SELECT SCOPE_IDENTITY() AS id;
        `);
      
      console.log('Manager user created with ID:', result.recordset[0].id);
    }
    
    console.log('Manager User Details:');
    console.log('Email: manager@insurance-brokerage.com');
    console.log('Password: Manager@123');
    console.log('Role: manager');
    console.log('Status: active');
    
    await sql.close();
  } catch (err) {
    console.error('Error creating manager user:', err);
    if (sql) await sql.close();
  }
}

createManagerUser(); 