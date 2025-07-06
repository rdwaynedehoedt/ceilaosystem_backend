
-- Script to update the role constraint to include 'employee'

-- First, identify the constraint name
DECLARE @ConstraintName NVARCHAR(128);
SELECT @ConstraintName = name
FROM sys.check_constraints
WHERE OBJECT_NAME(parent_object_id) = 'users' AND name LIKE 'CK%role%';

-- Output the constraint name for debugging
PRINT 'Found constraint: ' + ISNULL(@ConstraintName, 'No constraint found');

-- If constraint exists, drop it and recreate with employee role
IF @ConstraintName IS NOT NULL
BEGIN
    -- Create dynamic SQL to drop the constraint
    DECLARE @DropSQL NVARCHAR(MAX);
    SET @DropSQL = 'ALTER TABLE users DROP CONSTRAINT ' + @ConstraintName;
    
    -- Execute the drop statement
    EXEC sp_executesql @DropSQL;
    PRINT 'Dropped constraint: ' + @ConstraintName;
    
    -- Add new constraint that includes employee role
    ALTER TABLE users ADD CONSTRAINT CK_users_role 
    CHECK (role IN ('admin', 'manager', 'underwriter', 'sales', 'employee'));
    
    PRINT 'Added new constraint with employee role';
END
ELSE
BEGIN
    PRINT 'No constraint found, adding new constraint';
    
    -- Add new constraint that includes employee role
    ALTER TABLE users ADD CONSTRAINT CK_users_role 
    CHECK (role IN ('admin', 'manager', 'underwriter', 'sales', 'employee'));
    
    PRINT 'Added new constraint with employee role';
END

-- Now add the employee user
IF NOT EXISTS (SELECT * FROM users WHERE email = 'employee@example.com')
BEGIN
    -- Insert the employee user with a placeholder password (will be updated by the script)
    INSERT INTO users (
        email, 
        password, 
        first_name, 
        last_name, 
        role, 
        phone_number, 
        is_active, 
        created_at, 
        updated_at
    )
    VALUES (
        'employee@example.com',
        'PLACEHOLDER_TO_BE_UPDATED',
        'Employee',
        'User',
        'employee',
        '1234567890',
        1,
        GETDATE(),
        GETDATE()
    );
    
    PRINT 'Employee user added successfully';
END
ELSE
BEGIN
    PRINT 'User with email employee@example.com already exists';
END
