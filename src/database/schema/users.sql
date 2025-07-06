IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[users] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [email] VARCHAR(255) NOT NULL,
        [password] VARCHAR(255) NOT NULL,
        [first_name] VARCHAR(100) NOT NULL,
        [last_name] VARCHAR(100) NOT NULL,
        [role] VARCHAR(50) NOT NULL, -- Using VARCHAR instead of ENUM for SQL Server
        [phone_number] VARCHAR(20) NULL,
        [created_at] DATETIME DEFAULT GETDATE(),
        [updated_at] DATETIME DEFAULT GETDATE(),
        [is_active] BIT DEFAULT 1,
        [last_login] DATETIME NULL
    );
    
    -- Add unique constraint on email
    ALTER TABLE [dbo].[users] ADD CONSTRAINT UQ_users_email UNIQUE ([email]);
    
    -- Add index for faster login queries
    CREATE INDEX idx_users_email ON [dbo].[users] ([email]);
    
    PRINT 'Users table created successfully';
END
ELSE
BEGIN
    PRINT 'Users table already exists';
END 