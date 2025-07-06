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

# Schema Update Configuration
ENABLE_AUTO_SCHEMA_UPDATES=true|false  # Set to 'false' to disable automatic schema updates on server start

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

# Run database schema updates manually
npm run update-schema
```

## Database Schema Management

The application automatically applies database schema updates when it starts (unless disabled with `ENABLE_AUTO_SCHEMA_UPDATES=false`). 

To manually update the database schema:
```bash
npm run update-schema
```

All schema changes use conditional statements (`IF NOT EXISTS`) to ensure they only run when needed, making the process idempotent and safe to run multiple times.

## User Roles

The system supports the following user roles:

- **Admin**: Full access to all features and functionality
- **Manager**: Can manage clients, generate reports, and perform most operations
- **Employee**: Can view and add clients, but cannot edit or delete clients or generate reports
- **Sales**: Access to sales-specific features

### Setting Up the Employee Role

To set up the employee role, run:

```bash
node setup-employee-role.js
```

This script will:
1. Run the database migration to add the employee role
2. Provide instructions for creating an employee user

Once set up, employees can:
- Access the manager dashboard
- View client details
- Add new clients

But they cannot:
- Edit existing clients
- Delete clients
- Generate reports
- Import/export CSV files