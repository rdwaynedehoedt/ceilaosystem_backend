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

-- Add new text-only fields
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'ceilao_ib_file_no')
BEGIN
    ALTER TABLE clients ADD ceilao_ib_file_no VARCHAR(100);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'main_class')
BEGIN
    ALTER TABLE clients ADD main_class VARCHAR(100);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'insurer')
BEGIN
    ALTER TABLE clients ADD insurer VARCHAR(100);
END
GO

-- Add new document + text fields
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'policyholder_doc')
BEGIN
    ALTER TABLE clients ADD policyholder_doc VARCHAR(255);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'policyholder_text')
BEGIN
    ALTER TABLE clients ADD policyholder_text VARCHAR(500);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'vehicle_number_doc')
BEGIN
    ALTER TABLE clients ADD vehicle_number_doc VARCHAR(255);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'vehicle_number_text')
BEGIN
    ALTER TABLE clients ADD vehicle_number_text VARCHAR(100);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'proposal_form_doc')
BEGIN
    ALTER TABLE clients ADD proposal_form_doc VARCHAR(255);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'proposal_form_text')
BEGIN
    ALTER TABLE clients ADD proposal_form_text VARCHAR(500);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'quotation_doc')
BEGIN
    ALTER TABLE clients ADD quotation_doc VARCHAR(255);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'quotation_text')
BEGIN
    ALTER TABLE clients ADD quotation_text VARCHAR(500);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'cr_copy_doc')
BEGIN
    ALTER TABLE clients ADD cr_copy_doc VARCHAR(255);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'cr_copy_text')
BEGIN
    ALTER TABLE clients ADD cr_copy_text VARCHAR(500);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'schedule_doc')
BEGIN
    ALTER TABLE clients ADD schedule_doc VARCHAR(255);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'schedule_text')
BEGIN
    ALTER TABLE clients ADD schedule_text VARCHAR(500);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'invoice_debit_note_doc')
BEGIN
    ALTER TABLE clients ADD invoice_debit_note_doc VARCHAR(255);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'invoice_debit_note_text')
BEGIN
    ALTER TABLE clients ADD invoice_debit_note_text VARCHAR(500);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'payment_receipt_doc')
BEGIN
    ALTER TABLE clients ADD payment_receipt_doc VARCHAR(255);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'payment_receipt_text')
BEGIN
    ALTER TABLE clients ADD payment_receipt_text VARCHAR(500);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'nic_br_doc')
BEGIN
    ALTER TABLE clients ADD nic_br_doc VARCHAR(255);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = 'nic_br_text')
BEGIN
    ALTER TABLE clients ADD nic_br_text VARCHAR(500);
END
GO

PRINT 'Database schema updated with new fields';
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