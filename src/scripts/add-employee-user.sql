-- Add an employee user directly to the database
DECLARE @HashedPassword NVARCHAR(255);
SET @HashedPassword = '$2a$10$XvpvGTqxGbLPTn2Wy.xkDuBs0TvRmYM2GQWrG4KHaIODcgAMbPZwC'; -- Hashed value for 'Emp@123'

-- Check if user already exists
IF NOT EXISTS (SELECT * FROM users WHERE email = 'employee@example.com')
BEGIN
    -- Insert the employee user
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
        @HashedPassword,
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