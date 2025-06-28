import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { logPerformance } from '../middleware/logging';

// Use environment variable or generate a random strong secret
// In production, always use a persistent JWT_SECRET from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 
  crypto.randomBytes(64).toString('hex'); // Generate a secure random secret on startup

// Log warning if using a generated secret in production
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn(
    'WARNING: No JWT_SECRET environment variable set in production. ' +
    'Using a generated secret. This will invalidate all existing tokens on server restart!'
  );
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export const hashPassword = async (password: string): Promise<string> => {
  const startTime = process.hrtime();
  
  // Use a higher salt round in production for better security
  const saltRounds = process.env.NODE_ENV === 'production' ? 12 : 10;
  const salt = await bcrypt.genSalt(saltRounds);
  const hash = await bcrypt.hash(password, salt);
  
  const endTime = process.hrtime(startTime);
  const duration = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);
  
  logPerformance('password_hash', {
    timestamp: new Date().toISOString(),
    duration_ms: duration,
    salt_rounds: saltRounds
  });
  
  return hash;
};

export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  const startTime = process.hrtime();
  
  const isMatch = await bcrypt.compare(password, hashedPassword);
  
  const endTime = process.hrtime(startTime);
  const duration = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);
  
  logPerformance('password_compare', {
    timestamp: new Date().toISOString(),
    duration_ms: duration,
    success: isMatch
  });
  
  return isMatch;
};

export const generateToken = (userId: number, role: string): string => {
  const startTime = process.hrtime();
  
  const token = jwt.sign(
    { userId, role }, 
    JWT_SECRET, 
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
  
  const endTime = process.hrtime(startTime);
  const duration = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);
  
  logPerformance('token_generation', {
    timestamp: new Date().toISOString(),
    duration_ms: duration,
    expires_in: JWT_EXPIRES_IN
  });
  
  return token;
};

export const verifyToken = (token: string): any => {
  const startTime = process.hrtime();
  let result;
  let success = false;
  
  try {
    result = jwt.verify(token, JWT_SECRET);
    success = true;
    return result;
  } catch (error) {
    throw new Error('Invalid token');
  } finally {
    const endTime = process.hrtime(startTime);
    const duration = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);
    
    logPerformance('token_verification', {
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      success
    });
  }
}; 