import db from '../config/database';
import { hashPassword } from '../utils/auth';

async function seedDatabase() {
  try {
    const pool = await db.ensureConnection();
    
    // Clear existing users
    await pool.request().query('DELETE FROM users');
    
    // Create admin user
    const hashedPassword = await hashPassword('admin123');
    
    const adminRequest = pool.request();
    adminRequest.input('email', 'admin@example.com');
    adminRequest.input('password', hashedPassword);
    adminRequest.input('firstName', 'Admin');
    adminRequest.input('lastName', 'User');
    adminRequest.input('role', 'admin');
    adminRequest.input('phone', '+1234567890');
    adminRequest.input('isActive', 1);
    
    await adminRequest.query(`
      INSERT INTO users (email, password, first_name, last_name, role, phone_number, is_active, last_login, created_at, updated_at)
      VALUES (@email, @password, @firstName, @lastName, @role, @phone, @isActive, GETDATE(), GETDATE(), GETDATE())
    `);
    
    // Create manager user
    const managerRequest = pool.request();
    managerRequest.input('email', 'manager@example.com');
    managerRequest.input('password', hashedPassword);
    managerRequest.input('firstName', 'Manager');
    managerRequest.input('lastName', 'User');
    managerRequest.input('role', 'manager');
    managerRequest.input('phone', '+1234567891');
    managerRequest.input('isActive', 1);
    
    await managerRequest.query(`
      INSERT INTO users (email, password, first_name, last_name, role, phone_number, is_active, last_login, created_at, updated_at)
      VALUES (@email, @password, @firstName, @lastName, @role, @phone, @isActive, GETDATE(), GETDATE(), GETDATE())
    `);
    
    // Create underwriter user
    const underwriterRequest = pool.request();
    underwriterRequest.input('email', 'underwriter@example.com');
    underwriterRequest.input('password', hashedPassword);
    underwriterRequest.input('firstName', 'Underwriter');
    underwriterRequest.input('lastName', 'User');
    underwriterRequest.input('role', 'underwriter');
    underwriterRequest.input('phone', '+1234567892');
    underwriterRequest.input('isActive', 1);
    
    await underwriterRequest.query(`
      INSERT INTO users (email, password, first_name, last_name, role, phone_number, is_active, last_login, created_at, updated_at)
      VALUES (@email, @password, @firstName, @lastName, @role, @phone, @isActive, GETDATE(), GETDATE(), GETDATE())
    `);
    
    // Create sales user
    const salesRequest = pool.request();
    salesRequest.input('email', 'sales@example.com');
    salesRequest.input('password', hashedPassword);
    salesRequest.input('firstName', 'Sales');
    salesRequest.input('lastName', 'User');
    salesRequest.input('role', 'sales');
    salesRequest.input('phone', '+1234567893');
    salesRequest.input('isActive', 1);
    
    await salesRequest.query(`
      INSERT INTO users (email, password, first_name, last_name, role, phone_number, is_active, last_login, created_at, updated_at)
      VALUES (@email, @password, @firstName, @lastName, @role, @phone, @isActive, GETDATE(), GETDATE(), GETDATE())
    `);
    
    console.log('Test users created successfully');
    console.log('Database seeding completed');
    
    // No need to close the connection when using the pool
    console.log('Database connection will be returned to the pool');
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase(); 