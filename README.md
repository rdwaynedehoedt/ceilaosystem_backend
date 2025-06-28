# Insurance Brokerage Backend (Azure)

Backend API for the Insurance Brokerage system, migrated to Azure.

## Performance Optimizations

The backend has been optimized for performance, especially around the login process:

### Login Endpoint Optimizations

1. **Enhanced Logging and Timing**
   - Added detailed performance logging for key operations (database queries, password comparison, JWT generation)
   - All performance metrics are logged in structured JSON format for easier analysis
   - Anonymized user data in logs for privacy compliance

2. **Database Query Optimizations**
   - Added index on email column for faster user lookups
   - Optimized SELECT query to only fetch necessary fields
   - Made last_login updates asynchronous to improve response time

3. **Connection Pool Management**
   - Added connection pool monitoring via /api/metrics endpoint
   - Configured pool size via environment variables
   - Implemented keep-alive mechanism to prevent cold starts

4. **Security Improvements**
   - Enhanced JWT secret management with proper environment variable handling
   - Added warnings for insecure configurations
   - Configurable JWT expiration time

5. **Rate Limiting Preparation**
   - Added scaffolding for login rate limiting
   - Comments explaining implementation steps

## Monitoring Endpoints

- `/api/health` - Basic health check endpoint
- `/api/metrics` - Detailed metrics including:
  - Database connection pool stats
  - Memory usage
  - Server uptime

## Performance Monitoring Scripts

- `src/database/migrate-to-azure.ts` - Analyzes and applies database performance optimizations
- `src/database/update-schema.ts` - Updates database schema with performance improvements

## Environment Variables

```
# Server Configuration
PORT=5000
NODE_ENV=development|production

# Azure SQL Database
AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=your-database
AZURE_SQL_USER=your-username
AZURE_SQL_PASSWORD=your-password
AZURE_SQL_PORT=1433

# Connection Pool Configuration
DB_POOL_MAX=10
DB_POOL_MIN=0
DB_POOL_IDLE_TIMEOUT=30000

# JWT Configuration
JWT_SECRET=your-secure-jwt-secret
JWT_EXPIRES_IN=24h

# CORS Configuration
CORS_ORIGIN=https://your-frontend-domain.com
```

## Running the Application

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run in production mode
npm start
```