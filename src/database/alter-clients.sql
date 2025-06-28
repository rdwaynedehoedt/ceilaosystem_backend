-- Add new document fields to clients table if they don't exist
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'coverage_proof')
BEGIN
    ALTER TABLE clients ADD coverage_proof VARCHAR(255);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'sum_insured_proof')
BEGIN
    ALTER TABLE clients ADD sum_insured_proof VARCHAR(255);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'policy_fee_invoice')
BEGIN
    ALTER TABLE clients ADD policy_fee_invoice VARCHAR(255);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'vat_fee_debit_note')
BEGIN
    ALTER TABLE clients ADD vat_fee_debit_note VARCHAR(255);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'payment_receipt_proof')
BEGIN
    ALTER TABLE clients ADD payment_receipt_proof VARCHAR(255);
END
GO

PRINT 'Database schema updated with new document fields';
GO

-- Add email index to users table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_users_email' AND object_id = OBJECT_ID('users'))
BEGIN
    CREATE INDEX idx_users_email ON users(email);
    PRINT 'Created index on users.email for faster login queries';
END
ELSE
BEGIN
    PRINT 'Index on users.email already exists';
END
GO

-- Add any other performance-related database changes below 