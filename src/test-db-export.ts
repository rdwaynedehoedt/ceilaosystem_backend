import mssql from 'mssql';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// SQL Server connection configuration
const config = {
  server: process.env.AZURE_SQL_SERVER || '',
  database: process.env.AZURE_SQL_DATABASE || '',
  user: process.env.AZURE_SQL_USER || '',
  password: process.env.AZURE_SQL_PASSWORD || '',
  port: Number(process.env.AZURE_SQL_PORT) || 1433,
  options: {
    encrypt: true, // For Azure SQL
    trustServerCertificate: false,
    enableArithAbort: true
  },
  connectionTimeout: 30000,
  requestTimeout: 30000
};

async function exportDatabaseSchema(): Promise<void> {
  console.log('Connecting to Azure SQL Database...');
  console.log(`Server: ${config.server}`);
  console.log(`Database: ${config.database}`);
  console.log(`User: ${config.user}`);
  
  try {
    // Create connection pool
    const pool = await mssql.connect(config);
    console.log('Connected to database!');
    
    // Get all table information
    const tablesResult = await pool.request().query(`
      SELECT 
        t.name AS TableName,
        SCHEMA_NAME(t.schema_id) AS SchemaName
      FROM 
        sys.tables t
      ORDER BY 
        SchemaName, TableName
    `);
    
    console.log('\n=== TABLES ===');
    if (tablesResult.recordset.length === 0) {
      console.log('No tables found in the database.');
    } else {
      for (const table of tablesResult.recordset) {
        console.log(`- ${table.SchemaName}.${table.TableName}`);
      }
    }
    
    // For each table, get columns and constraints
    console.log('\n=== TABLE DETAILS ===');
    
    for (const table of tablesResult.recordset) {
      const fullTableName = `${table.SchemaName}.${table.TableName}`;
      
      console.log(`\nTable: ${fullTableName}`);
      console.log('-'.repeat(fullTableName.length + 7));
      
      // Get columns
      const columnsResult = await pool.request()
        .input('schema', table.SchemaName)
        .input('table', table.TableName)
        .query(`
          SELECT 
            c.COLUMN_NAME as name,
            c.DATA_TYPE as data_type,
            CASE 
              WHEN c.CHARACTER_MAXIMUM_LENGTH = -1 THEN 'MAX'
              ELSE CAST(COALESCE(c.CHARACTER_MAXIMUM_LENGTH, '') AS VARCHAR)
            END as max_length,
            CAST(COALESCE(c.NUMERIC_PRECISION, '') AS VARCHAR) as precision,
            CAST(COALESCE(c.NUMERIC_SCALE, '') AS VARCHAR) as scale,
            c.IS_NULLABLE as is_nullable,
            c.COLUMN_DEFAULT as default_value,
            CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'PK' ELSE '' END as primary_key
          FROM 
            INFORMATION_SCHEMA.COLUMNS c
            LEFT JOIN (
              SELECT 
                ku.TABLE_SCHEMA,
                ku.TABLE_NAME,
                ku.COLUMN_NAME
              FROM 
                INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                  ON tc.CONSTRAINT_TYPE = 'PRIMARY KEY' 
                  AND tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
            ) pk 
              ON c.TABLE_SCHEMA = pk.TABLE_SCHEMA 
              AND c.TABLE_NAME = pk.TABLE_NAME 
              AND c.COLUMN_NAME = pk.COLUMN_NAME
          WHERE 
            c.TABLE_SCHEMA = @schema
            AND c.TABLE_NAME = @table
          ORDER BY 
            c.ORDINAL_POSITION
        `);
      
      // Print columns
      for (const col of columnsResult.recordset) {
        let columnType = col.data_type;
        
        // Add length/precision/scale for types that need it
        if (['varchar', 'nvarchar', 'char', 'nchar'].includes(columnType.toLowerCase()) && col.max_length) {
          columnType += `(${col.max_length})`;
        } else if (['decimal', 'numeric'].includes(columnType.toLowerCase()) && col.precision) {
          columnType += `(${col.precision}, ${col.scale})`;
        }
        
        let constraints = [];
        if (col.primary_key) constraints.push('PRIMARY KEY');
        if (col.is_nullable === 'NO') constraints.push('NOT NULL');
        if (col.default_value) constraints.push(`DEFAULT ${col.default_value}`);
        
        console.log(`${col.name} ${columnType}${constraints.length > 0 ? ' ' + constraints.join(', ') : ''}`);
      }
      
      // Get foreign keys
      const fkResult = await pool.request()
        .input('schema', table.SchemaName)
        .input('table', table.TableName)
        .query(`
          SELECT 
            fk.name AS constraint_name,
            COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS column_name,
            OBJECT_SCHEMA_NAME(fk.referenced_object_id) + '.' + OBJECT_NAME(fk.referenced_object_id) AS referenced_table,
            COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS referenced_column
          FROM 
            sys.foreign_keys fk
            JOIN sys.foreign_key_columns fkc 
              ON fk.object_id = fkc.constraint_object_id
            JOIN sys.tables t 
              ON fk.parent_object_id = t.object_id
            JOIN sys.schemas s 
              ON t.schema_id = s.schema_id
          WHERE 
            s.name = @schema
            AND t.name = @table
        `);
      
      // Print foreign keys
      if (fkResult.recordset.length > 0) {
        console.log('\nForeign Keys:');
        for (const fk of fkResult.recordset) {
          console.log(`  ${fk.constraint_name}: ${fk.column_name} -> ${fk.referenced_table}(${fk.referenced_column})`);
        }
      }
      
      // Get indexes
      const indexResult = await pool.request()
        .input('schema', table.SchemaName)
        .input('table', table.TableName)
        .query(`
          SELECT 
            i.name AS index_name,
            CASE WHEN i.is_unique = 1 THEN 'UNIQUE' ELSE 'NON-UNIQUE' END AS uniqueness,
            STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS columns
          FROM 
            sys.indexes i
            JOIN sys.index_columns ic 
              ON i.object_id = ic.object_id 
              AND i.index_id = ic.index_id
            JOIN sys.columns c 
              ON ic.object_id = c.object_id 
              AND ic.column_id = c.column_id
            JOIN sys.tables t 
              ON i.object_id = t.object_id
            JOIN sys.schemas s 
              ON t.schema_id = s.schema_id
          WHERE 
            s.name = @schema
            AND t.name = @table
            AND i.is_primary_key = 0 -- Exclude primary keys as they're already listed
          GROUP BY
            i.name, i.is_unique
        `);
      
      // Print indexes
      if (indexResult.recordset.length > 0) {
        console.log('\nIndexes:');
        for (const idx of indexResult.recordset) {
          console.log(`  ${idx.index_name} (${idx.uniqueness}): ${idx.columns}`);
        }
      }
      
      // Get row count
      try {
        const countResult = await pool.request().query(`SELECT COUNT(*) AS count FROM ${fullTableName}`);
        console.log(`\nRow count: ${countResult.recordset[0].count}`);
      } catch (error: any) {
        console.log(`\nError getting row count: ${error.message}`);
      }
    }
    
    // Close the connection
    await pool.close();
    console.log('\nConnection closed.');
    
  } catch (error: any) {
    console.error('Error connecting to database:', error.message);
  }
}

// Run the extraction
exportDatabaseSchema().catch(console.error); 