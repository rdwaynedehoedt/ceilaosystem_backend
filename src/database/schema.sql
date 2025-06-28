-- Create database (Note: In Azure, the database is usually created through the portal)
-- IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'insurance_brokerage')
-- BEGIN
--     CREATE DATABASE insurance_brokerage;
-- END
-- GO

-- Use the database
USE insurance_brokerage;
GO

-- Create users table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
BEGIN
    CREATE TABLE users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'underwriter', 'sales')),
        phone_number VARCHAR(20),
        is_active BIT DEFAULT 1,
        last_login DATETIME NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
    );
END
GO

-- Insert default admin user if not exists (password: admin123)
IF NOT EXISTS (SELECT * FROM users WHERE email = 'admin@example.com')
BEGIN
    INSERT INTO users (email, password, first_name, last_name, role, phone_number)
    VALUES (
        'admin@example.com',
        '$2a$10$X7UrH5YxX5YxX5YxX5YxX.5YxX5YxX5YxX5YxX5YxX5YxX5YxX5Yx',
        'Admin',
        'User',
        'admin',
        '+1234567890'
    );
END
GO

-- Create clients table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'clients')
BEGIN
    CREATE TABLE clients (
        id VARCHAR(50) PRIMARY KEY,
        introducer_code VARCHAR(50),
        customer_type VARCHAR(50) NOT NULL,
        product VARCHAR(50) NOT NULL,
        policy_ VARCHAR(100),
        insurance_provider VARCHAR(100) NOT NULL,
        branch VARCHAR(100),
        client_name VARCHAR(255) NOT NULL,
        street1 VARCHAR(255),
        street2 VARCHAR(255),
        city VARCHAR(100),
        district VARCHAR(100),
        province VARCHAR(100),
        telephone VARCHAR(50),
        mobile_no VARCHAR(50) NOT NULL,
        contact_person VARCHAR(255),
        email VARCHAR(255),
        social_media VARCHAR(255),
        nic_proof VARCHAR(255),
        dob_proof VARCHAR(255),
        business_registration VARCHAR(255),
        svat_proof VARCHAR(255),
        vat_proof VARCHAR(255),
        policy_type VARCHAR(100),
        policy_no VARCHAR(100),
        policy_period_from VARCHAR(50),
        policy_period_to VARCHAR(50),
        coverage VARCHAR(255),
        sum_insured DECIMAL(15, 2) DEFAULT 0,
        basic_premium DECIMAL(15, 2) DEFAULT 0,
        srcc_premium DECIMAL(15, 2) DEFAULT 0,
        tc_premium DECIMAL(15, 2) DEFAULT 0,
        net_premium DECIMAL(15, 2) DEFAULT 0,
        stamp_duty DECIMAL(15, 2) DEFAULT 0,
        admin_fees DECIMAL(15, 2) DEFAULT 0,
        road_safety_fee DECIMAL(15, 2) DEFAULT 0,
        policy_fee DECIMAL(15, 2) DEFAULT 0,
        vat_fee DECIMAL(15, 2) DEFAULT 0,
        total_invoice DECIMAL(15, 2) DEFAULT 0,
        debit_note VARCHAR(100),
        payment_receipt VARCHAR(100),
        commission_type VARCHAR(50),
        commission_basic DECIMAL(15, 2) DEFAULT 0,
        commission_srcc DECIMAL(15, 2) DEFAULT 0,
        commission_tc DECIMAL(15, 2) DEFAULT 0,
        sales_rep_id INT,
        policies INT DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (sales_rep_id) REFERENCES users(id) ON DELETE SET NULL
    );
END
GO

-- Create index on common search fields if they don't exist
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_client_name')
BEGIN
    CREATE INDEX idx_client_name ON clients(client_name);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_mobile_no')
BEGIN
    CREATE INDEX idx_mobile_no ON clients(mobile_no);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_policy_no')
BEGIN
    CREATE INDEX idx_policy_no ON clients(policy_no);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_product')
BEGIN
    CREATE INDEX idx_product ON clients(product);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_sales_rep')
BEGIN
    CREATE INDEX idx_sales_rep ON clients(sales_rep_id);
END
GO 