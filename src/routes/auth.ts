import { Router, Request, Response } from 'express';
import db from '../config/database';
import { hashPassword, comparePassword, generateToken } from '../utils/auth';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { logPerformance } from '../middleware/logging';

const router = Router();

// Login route
router.post('/login', async (req: Request, res: Response) => {
  // Start overall timing
  const startTimeTotal = process.hrtime();
  const logData: any = {
    event: 'login_attempt',
    email_hash: req.body.email ? Buffer.from(req.body.email).toString('base64').substring(0, 10) : 'none', // Basic anonymization
    timestamp: new Date().toISOString(),
    success: false
  };

  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      logData.failure_reason = 'missing_credentials';
      logPerformance('login', logData);
      return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
    // DB Connection timing
    const startTimeDbConn = process.hrtime();
      // Get connection from pool with resilience
      const pool = await db.ensureConnection();
    const dbConnTime = process.hrtime(startTimeDbConn);
    logData.db_connection_ms = (dbConnTime[0] * 1000 + dbConnTime[1] / 1000000).toFixed(2);
    
    // DB Query timing
    const startTimeDbQuery = process.hrtime();
    // Get user from database - optimized to select only necessary fields
    const result = await pool.request()
      .input('email', email)
      .query('SELECT id, email, password, first_name, last_name, role, status FROM users WHERE email = @email');
    
    const dbQueryTime = process.hrtime(startTimeDbQuery);
    logData.db_query_ms = (dbQueryTime[0] * 1000 + dbQueryTime[1] / 1000000).toFixed(2);
    
    const user = result.recordset[0];

    if (!user) {
      logData.failure_reason = 'invalid_credentials';
      logData.success = false;
      logPerformance('login', logData);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Password comparison timing
    const startTimePwdCheck = process.hrtime();
    // Check password
    const isValidPassword = await comparePassword(password, user.password);
    const pwdCheckTime = process.hrtime(startTimePwdCheck);
    logData.password_check_ms = (pwdCheckTime[0] * 1000 + pwdCheckTime[1] / 1000000).toFixed(2);
    
    if (!isValidPassword) {
      logData.failure_reason = 'invalid_credentials';
      logData.success = false;
      logPerformance('login', logData);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if account is active
    if (user.status !== 'active') {
      logData.failure_reason = 'account_inactive';
      logData.success = false;
      logPerformance('login', logData);
      return res.status(403).json({ message: 'Account is not active. Please contact administrator.' });
    }

    // JWT generation timing
    const startTimeJwt = process.hrtime();
    // Generate token
    const token = generateToken(user.id, user.role);
    const jwtTime = process.hrtime(startTimeJwt);
    logData.jwt_generation_ms = (jwtTime[0] * 1000 + jwtTime[1] / 1000000).toFixed(2);

    // Update last login asynchronously - don't wait for it to complete
    (async () => {
      try {
        const updateStartTime = process.hrtime();
          const updatePool = await db.getConnection();
          await updatePool.request()
          .input('id', user.id)
          .query('UPDATE users SET last_login = GETDATE() WHERE id = @id');
        const updateTime = process.hrtime(updateStartTime);
        console.log(JSON.stringify({
          event: 'last_login_update',
          user_id: user.id,
          timestamp: new Date().toISOString(),
          duration_ms: (updateTime[0] * 1000 + updateTime[1] / 1000000).toFixed(2)
        }));
      } catch (updateError) {
        console.error('Failed to update last login time:', updateError);
      }
    })();

    // Calculate total time
    const totalTime = process.hrtime(startTimeTotal);
    logData.total_duration_ms = (totalTime[0] * 1000 + totalTime[1] / 1000000).toFixed(2);
    logData.success = true;
    logPerformance('login', logData);

    // Return user data and token
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      }
    });
    } catch (dbError) {
      console.error('Database error during login:', dbError);
      logData.failure_reason = 'database_error';
      logData.error = dbError instanceof Error ? dbError.message : 'Unknown DB error';
      
      // Try to reconnect
      try {
        await db.ensureConnection();
      } catch (reconnectError) {
        console.error('Failed to reconnect to database:', reconnectError);
      }
      
      // Return error to client
      return res.status(503).json({ message: 'Database service unavailable, please try again later' });
    }
  } catch (error) {
    const totalTime = process.hrtime(startTimeTotal);
    logData.total_duration_ms = (totalTime[0] * 1000 + totalTime[1] / 1000000).toFixed(2);
    logData.error = error instanceof Error ? error.message : 'Unknown error';
    logData.failure_reason = 'server_error';
    logPerformance('login', logData);
    
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    try {
      // Get connection from pool with resilience
      const pool = await db.ensureConnection();
    
    const result = await pool.request()
      .input('userId', req.user?.userId)
      .query('SELECT id, email, first_name, last_name, role FROM users WHERE id = @userId');

    const user = result.recordset[0];
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role
    });
    } catch (dbError) {
      console.error('Database error getting user:', dbError);
      
      // Try to reconnect
      try {
        await db.ensureConnection();
      } catch (reconnectError) {
        console.error('Failed to reconnect to database:', reconnectError);
      }
      
      // Return error to client
      return res.status(503).json({ message: 'Database service unavailable, please try again later' });
    }
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new user (admin only)
router.post('/users', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
  try {
    const { email, password, firstName, lastName, role, phoneNumber } = req.body;

    // Validate input
    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

      // Get connection from pool with resilience
      const pool = await db.ensureConnection();
    
    // Check if email already exists
    const existingUser = await pool.request()
      .input('email', email)
      .query('SELECT id FROM users WHERE email = @email');

    if (existingUser.recordset.length > 0) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Insert user
    const result = await pool.request()
      .input('email', email)
      .input('password', hashedPassword)
      .input('firstName', firstName)
      .input('lastName', lastName)
      .input('role', role)
      .input('phoneNumber', phoneNumber || null)
      .input('status', 'active')
      .query(`
        INSERT INTO users (email, password, first_name, last_name, role, phone_number, status)
        VALUES (@email, @password, @firstName, @lastName, @role, @phoneNumber, @status);
        SELECT SCOPE_IDENTITY() AS id;
      `);

    res.status(201).json({
      message: 'User created successfully',
      userId: result.recordset[0].id
    });
    } catch (dbError) {
      console.error('Database error creating user:', dbError);
      
      // Try to reconnect
      try {
        await db.ensureConnection();
      } catch (reconnectError) {
        console.error('Failed to reconnect to database:', reconnectError);
      }
      
      // Return error to client
      return res.status(503).json({ message: 'Database service unavailable, please try again later' });
    }
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router; 