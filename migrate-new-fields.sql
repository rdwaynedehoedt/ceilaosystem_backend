-- Migration script to add new fields to clients table
-- Run this script in your database to add the new fields

-- Add new fields for enhanced client management
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ceilao_ib_file_no VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS policyholder VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(50);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS main_class VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS proposal_form_doc VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS proposal_form_field VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS quotation_doc VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS quotation_field VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS schedule_doc VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cr_copy_doc VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_debit_note_doc VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_debit_note_field VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_receipt_doc VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_receipt_field VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS nic_br_doc VARCHAR(255);

-- Add indexes for the new fields (optional, for better performance)
CREATE INDEX IF NOT EXISTS idx_ceilao_ib_file_no ON clients(ceilao_ib_file_no);
CREATE INDEX IF NOT EXISTS idx_policyholder ON clients(policyholder);
CREATE INDEX IF NOT EXISTS idx_vehicle_number ON clients(vehicle_number);

-- Update existing records to set default values for new fields
UPDATE clients SET 
    ceilao_ib_file_no = COALESCE(ceilao_ib_file_no, ''),
    policyholder = COALESCE(policyholder, ''),
    vehicle_number = COALESCE(vehicle_number, ''),
    main_class = COALESCE(main_class, ''),
    proposal_form_doc = COALESCE(proposal_form_doc, ''),
    proposal_form_field = COALESCE(proposal_form_field, ''),
    quotation_doc = COALESCE(quotation_doc, ''),
    quotation_field = COALESCE(quotation_field, ''),
    schedule_doc = COALESCE(schedule_doc, ''),
    cr_copy_doc = COALESCE(cr_copy_doc, ''),
    invoice_debit_note_doc = COALESCE(invoice_debit_note_doc, ''),
    invoice_debit_note_field = COALESCE(invoice_debit_note_field, ''),
    payment_receipt_doc = COALESCE(payment_receipt_doc, ''),
    payment_receipt_field = COALESCE(payment_receipt_field, ''),
    nic_br_doc = COALESCE(nic_br_doc, '')
WHERE ceilao_ib_file_no IS NULL 
   OR policyholder IS NULL 
   OR vehicle_number IS NULL 
   OR main_class IS NULL 
   OR proposal_form_doc IS NULL 
   OR proposal_form_field IS NULL 
   OR quotation_doc IS NULL 
   OR quotation_field IS NULL 
   OR schedule_doc IS NULL 
   OR cr_copy_doc IS NULL 
   OR invoice_debit_note_doc IS NULL 
   OR invoice_debit_note_field IS NULL 
   OR payment_receipt_doc IS NULL 
   OR payment_receipt_field IS NULL 
   OR nic_br_doc IS NULL;

-- Verify the changes
SELECT 
    'Migration completed successfully' as status,
    COUNT(*) as total_clients,
    COUNT(ceilao_ib_file_no) as clients_with_ceilao_ib_file_no,
    COUNT(policyholder) as clients_with_policyholder,
    COUNT(vehicle_number) as clients_with_vehicle_number
FROM clients; 