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
import updateSchema from './database/update-schema';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const port = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
// Configuration for auto schema updates (default to true if not specified)
const enableAutoSchemaUpdates = process.env.ENABLE_AUTO_SCHEMA_UPDATES !== 'false';

// Configure CORS
const corsOptions = {
  origin: isProduction 
    ? [process.env.FRONTEND_URL || '', /\.choreoapis\.dev$/] 
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for development, consider enabling for production
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  const dbStats = getPoolStats();
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      connected: dbStats.connected,
      poolSize: dbStats.size,
      available: dbStats.available,
      borrowed: dbStats.borrowed,
      pending: dbStats.pending
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/documents', documentsRoutes);

// Error handling
app.use(errorLogger);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ 
    success: false, 
    message: `Route ${req.method} ${req.path} not found` 
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: isProduction ? 'Internal server error' : err.message,
    stack: isProduction ? undefined : err.stack
  });
});

// Initialize database and start server
(async () => {
  try {
    // First ensure we can connect to the database
    await db.ensureConnection();
    console.log('Database connection verified');
    
    // Run schema updates only if enabled
    if (enableAutoSchemaUpdates) {
      console.log('Running database schema updates...');
      const schemaUpdateSuccess = await updateSchema();
      
      if (schemaUpdateSuccess) {
        console.log('Database schema update completed successfully');
      } else {
        console.warn('Database schema update failed, some features may not work correctly');
      }
    } else {
      console.log('Automatic schema updates are disabled. Use npm run update-schema to update manually.');
    }
    
    // Start server
    app.listen(port, () => {
      console.log(`Server is running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
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
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
})();