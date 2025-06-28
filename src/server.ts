import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import authRoutes from './routes/auth';
import clientRoutes from './routes/clients';
import documentsRoutes from './routes/documents';
import { errorLogger, requestLogger } from './middleware/logging';
import db, { getPoolStats, keepConnectionWarm } from './config/database';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
const corsOptions = {
  origin: isProduction 
    ? [process.env.CORS_ORIGIN, 'https://ceilaosystem.t3xlk.com'].filter(Boolean) as string[]
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Allow cookies to be sent with requests
  exposedHeaders: ['Content-Type', 'Content-Disposition'], // Expose headers for download
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' } // Allow cross-origin resource sharing
})); // Security headers
app.use(compression()); // Gzip compression
app.use(express.json());
app.use(requestLogger); // Log all requests

// Add DB connectivity check middleware for critical endpoints
const checkDatabaseConnection = async (req: Request, res: Response, next: NextFunction) => {
  // Only check on auth endpoints
  if (req.path.startsWith('/api/auth')) {
    try {
      await db.ensureConnection();
      next();
    } catch (err) {
      console.error('Database connectivity check failed:', err);
      return res.status(503).json({
        message: 'Database service unavailable, please try again later',
        error: isProduction ? undefined : (err instanceof Error ? err.message : String(err))
      });
    }
  } else {
    // Skip check for non-critical endpoints
    next();
  }
};

// Apply the database check middleware
app.use(checkDatabaseConnection);

// TODO: Implement rate limiting for sensitive endpoints, especially login
// Example setup for rate limiting (uncomment and install 'express-rate-limit' package)
/*
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting to login endpoint
app.use('/api/auth/login', loginLimiter);
*/

// Remove test routes in production
/*
if (!isProduction) {
  const testRoutes = require('./routes/test').default;
  app.use('/api', testRoutes);
}
*/

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/documents', documentsRoutes);

// Basic route
app.get('/', (req: Request, res: Response) => {
  res.json({ 
    message: 'Insurance Brokerage API',
    version: '1.0.0',
    status: 'running'
  });
});

// Health check endpoint
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    // Check database connectivity
    await db.getConnection();
    res.status(200).json({ status: 'ok', database_connection: 'ok' });
  } catch (error) {
    console.error('Health check detected database issue:', error);
    res.status(200).json({ 
      status: 'degraded', 
      database_connection: 'error', 
      details: isProduction ? undefined : (error instanceof Error ? error.message : String(error))
    });
  }
});

// Metrics endpoint (for internal monitoring)
app.get('/api/metrics', async (req: Request, res: Response) => {
  try {
    res.status(200).json({
      timestamp: new Date().toISOString(),
      db_pool: getPoolStats(),
      memory_usage: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024), // RSS in MB
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024), // Heap total in MB
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // Heap used in MB
        external: Math.round(process.memoryUsage().external / 1024 / 1024) // External in MB
      },
      uptime: process.uptime()
    });
  } catch (error) {
    console.error('Metrics endpoint error:', error);
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  errorLogger(err);
  res.status(500).json({
    error: isProduction ? 'Internal Server Error' : err.message
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Setup more aggressive keep-alive mechanism to prevent cold starts
const KEEP_ALIVE_INTERVAL = isProduction ? 2 * 60 * 1000 : 5 * 60 * 1000; // 2 minutes in prod, 5 minutes in dev
setInterval(() => {
  keepConnectionWarm()
    .then(success => {
      if (!success) {
        console.warn('Database keep-alive failed');
      }
    })
    .catch(err => {
      console.error('Error in keep-alive mechanism:', err);
    });
}, KEEP_ALIVE_INTERVAL);

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
  
  // Initial connection check
  db.ensureConnection()
    .then(() => console.log('Database connection verified on startup'))
    .catch(err => console.error('Database connection failed on startup, will retry later:', err));
}); 