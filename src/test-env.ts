import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Print environment variables (with masking for sensitive values)
function printEnvVar(name: string, maskSensitive = false) {
  const value = process.env[name];
  if (value === undefined) {
    console.log(`${name}: NOT SET`);
  } else if (maskSensitive && value.length > 20) {
    // Mask middle part of sensitive strings
    const maskedValue = value.substring(0, 10) + '...' + value.substring(value.length - 10);
    console.log(`${name}: ${maskedValue} (length: ${value.length})`);
  } else {
    console.log(`${name}: ${value}`);
  }
}

console.log('\n=== ENVIRONMENT VARIABLES ===');
console.log('NODE_ENV:', process.env.NODE_ENV || 'not set');

console.log('\n=== SERVER CONFIG ===');
printEnvVar('PORT');
printEnvVar('CORS_ORIGIN');

console.log('\n=== AZURE STORAGE CONFIG ===');
printEnvVar('AZURE_STORAGE_CONNECTION_STRING', true);
printEnvVar('AZURE_STORAGE_CONTAINER_NAME');

console.log('\n=== AZURE SQL CONFIG ===');
printEnvVar('AZURE_SQL_SERVER');
printEnvVar('AZURE_SQL_DATABASE');
printEnvVar('AZURE_SQL_USER');
printEnvVar('AZURE_SQL_PASSWORD', true);

console.log('\n=== AUTH CONFIG ===');
printEnvVar('JWT_SECRET', true);
printEnvVar('JWT_EXPIRATION');

console.log('\n=== RUNTIME INFO ===');
console.log('Current directory:', process.cwd());
console.log('Node version:', process.version);
console.log('Platform:', process.platform);

console.log('\n=== CHECKING AZURE STORAGE CONNECTION ===');
// Check if we have a connection string
if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
  console.log('❌ AZURE_STORAGE_CONNECTION_STRING is not set');
} else {
  console.log('✓ AZURE_STORAGE_CONNECTION_STRING is set');
  
  // Check if the connection string looks valid (basic format check)
  const connString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (connString.includes('AccountName=') && 
      connString.includes('AccountKey=') && 
      connString.includes('EndpointSuffix=')) {
    console.log('✓ Connection string format appears valid');
  } else {
    console.log('❌ Connection string format appears invalid');
  }
}

// Check container name
if (!process.env.AZURE_STORAGE_CONTAINER_NAME) {
  console.log('❌ AZURE_STORAGE_CONTAINER_NAME is not set, using default "customer-documents"');
} else {
  console.log('✓ AZURE_STORAGE_CONTAINER_NAME is set to', process.env.AZURE_STORAGE_CONTAINER_NAME);
}

console.log('\nAdd this script to your package.json:');
console.log('"test-env": "ts-node src/test-env.ts"'); 