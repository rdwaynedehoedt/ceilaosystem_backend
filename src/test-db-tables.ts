import mssql from 'mssql';
import dotenv from 'dotenv';

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

interface TableRecord {
  TableName: string;
  SchemaName: string;
}

interface ColumnRecord {
  TableName: string;
  SchemaName: string;
  ColumnName: string;
  DataType: string;
  MaxLength: number;
  Precision: number;
  Scale: number;
  IsNullable: boolean;
  IsPrimaryKey: number;
  IsForeignKey: number;
  ReferencedTable: string | null;
  ReferencedColumn: string | null;
}

interface TableGroups {
  [key: string]: ColumnRecord[];
}

async function extractDatabaseSchema() {
  console.log('Connecting to Azure SQL Database...');
  console.log(`Server: ${config.server}`);
  console.log(`Database: ${config.database}`);
  console.log(`User: ${config.user}`);
  
  try {
    // Create connection pool
    const pool = await mssql.connect(config);
    console.log('Connected to database!');
    
    // Get all tables
    const tablesResult = await pool.request().query<TableRecord>(`
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
    
    // Get all tables with column details
    const tableDetailsQuery = `
      SELECT 
        t.name AS TableName,
        SCHEMA_NAME(t.schema_id) AS SchemaName,
        c.name AS ColumnName,
        ty.name AS DataType,
        c.max_length AS MaxLength,
        c.precision AS Precision,
        c.scale AS Scale,
        c.is_nullable AS IsNullable,
        CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END AS IsPrimaryKey,
        CASE WHEN fk.parent_column_id IS NOT NULL THEN 1 ELSE 0 END AS IsForeignKey,
        OBJECT_NAME(fk.referenced_object_id) AS ReferencedTable,
        COL_NAME(fk.referenced_object_id, fk.referenced_column_id) AS ReferencedColumn
      FROM 
        sys.tables t
        INNER JOIN sys.columns c ON c.object_id = t.object_id
        INNER JOIN sys.types ty ON ty.user_type_id = c.user_type_id
        LEFT JOIN sys.index_columns pk ON pk.object_id = t.object_id 
          AND pk.column_id = c.column_id 
          AND pk.index_id = 1
        LEFT JOIN sys.foreign_key_columns fk ON fk.parent_object_id = t.object_id 
          AND fk.parent_column_id = c.column_id
      ORDER BY 
        SchemaName, TableName, c.column_id
    `;
    
    const detailsResult = await pool.request().query<ColumnRecord>(tableDetailsQuery);
    
    console.log('\n=== TABLE DETAILS ===');
    
    // Group results by table
    const tableGroups: TableGroups = {};
    for (const row of detailsResult.recordset) {
      const tableKey = `${row.SchemaName}.${row.TableName}`;
      if (!tableGroups[tableKey]) {
        tableGroups[tableKey] = [];
      }
      tableGroups[tableKey].push(row);
    }
    
    // Print each table's details
    for (const [tableName, columns] of Object.entries(tableGroups)) {
      console.log(`\nTable: ${tableName}`);
      console.log('-'.repeat(tableName.length + 7));
      
      for (const column of columns) {
        let dataType = column.DataType;
        if (column.DataType === 'varchar' || column.DataType === 'nvarchar' || column.DataType === 'char' || column.DataType === 'nchar') {
          dataType += `(${column.MaxLength === -1 ? 'MAX' : column.MaxLength / (column.DataType.startsWith('n') ? 2 : 1)})`;
        } else if (column.DataType === 'decimal' || column.DataType === 'numeric') {
          dataType += `(${column.Precision}, ${column.Scale})`;
        }
        
        const constraints = [];
        if (column.IsPrimaryKey) constraints.push('PRIMARY KEY');
        if (column.IsForeignKey) constraints.push(`FOREIGN KEY REFERENCES ${column.ReferencedTable}(${column.ReferencedColumn})`);
        if (!column.IsNullable) constraints.push('NOT NULL');
        
        console.log(`${column.ColumnName} ${dataType}${constraints.length > 0 ? ' ' + constraints.join(', ') : ''}`);
      }
    }
    
    // Get table row counts
    console.log('\n=== TABLE ROW COUNTS ===');
    for (const [tableName, _] of Object.entries(tableGroups)) {
      try {
        const countResult = await pool.request().query(`SELECT COUNT(*) AS count FROM ${tableName}`);
        const rowCount = countResult.recordset[0].count;
        console.log(`${tableName}: ${rowCount} rows`);
      } catch (error: any) {
        console.log(`${tableName}: Error getting row count - ${error.message}`);
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
extractDatabaseSchema().catch(console.error); 