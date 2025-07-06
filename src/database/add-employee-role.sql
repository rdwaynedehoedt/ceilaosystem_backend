-- Add employee role to the users table
-- For MS SQL Server, we need to use ALTER TABLE with ALTER COLUMN
IF EXISTS (SELECT * FROM sys.columns WHERE Name = 'role' AND Object_ID = Object_ID('users'))
BEGIN
    -- First check if we need to add the employee role
    IF NOT EXISTS (
        SELECT * 
        FROM sys.columns c 
        INNER JOIN sys.types t ON c.system_type_id = t.system_type_id
        WHERE c.object_id = OBJECT_ID('users') 
        AND c.name = 'role'
        AND t.name = 'varchar' 
        AND c.max_length >= 50
    )
    BEGIN
        -- Alter the column to be VARCHAR(50) to accommodate all roles
        ALTER TABLE users ALTER COLUMN role VARCHAR(50) NOT NULL;
        PRINT 'Column role altered to VARCHAR(50)';
    END

    -- Update existing values to ensure consistency
    UPDATE users SET role = 'admin' WHERE role = 'admin';
    UPDATE users SET role = 'manager' WHERE role = 'manager';
    UPDATE users SET role = 'sales' WHERE role = 'sales';
    UPDATE users SET role = 'underwriter' WHERE role = 'underwriter';
    
    PRINT 'Employee role added to users table';
END
ELSE
BEGIN
    PRINT 'Role column not found in users table';
END 