import { Request, Response, NextFunction } from 'express';

/**
 * Logs all incoming requests
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Log when the request finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;
    
    console.log(
      `[${new Date().toISOString()}] ${method} ${originalUrl} ${statusCode} ${duration}ms - ${ip}`
    );
  });
  
  next();
};

/**
 * Logs errors that occur during request processing
 */
export const errorLogger = (err: Error) => {
  console.error(`[${new Date().toISOString()}] ERROR: ${err.message}`);
  console.error(err.stack);
  
  // In a production environment, you might want to log to a file or external service
  // This is where you would integrate with services like Application Insights, Winston, etc.
};

/**
 * Logs performance metrics in a structured JSON format
 * @param operation - The operation being performed (e.g., 'login', 'file_upload')
 * @param data - Object containing performance metrics and contextual information
 */
export const logPerformance = (operation: string, data: Record<string, any>) => {
  // Add operation name to the data
  const logData = {
    operation,
    ...data,
  };
  
  // Log as structured JSON for easier parsing by log analysis tools
  console.log(JSON.stringify(logData));
  
  // TODO: In production, send these metrics to Application Insights or another monitoring service
  // Example: if (process.env.NODE_ENV === 'production' && appInsights) {
  //   appInsights.trackMetric({ name: `${operation}_duration`, value: data.total_duration_ms });
  // }
}; 