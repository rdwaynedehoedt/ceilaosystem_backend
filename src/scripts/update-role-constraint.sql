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