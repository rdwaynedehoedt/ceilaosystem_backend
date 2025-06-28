const sql = require('mssql');
require('dotenv').config();

// Configure the connection
const config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  port: Number(process.env.AZURE_SQL_PORT) || 1433,
  options: {
    encrypt: true, // For Azure SQL
    trustServerCertificate: false
  }
};

console.log("Connection config:", {
  server: config.server,
  database: config.database,
  user: config.user
});

async function extractSchema() {
  try {
    // Connect to database
    await sql.connect(config);
    console.log("Connected to database!");

    // Get all tables
    const tablesResult = await sql.query`
      SELECT 
        t.name AS TableName,
        SCHEMA_NAME(t.schema_id) AS SchemaName
      FROM 
        sys.tables t
      ORDER BY 
        SchemaName, TableName
    `;

    console.log("\n=== TABLES ===");
    console.log(tablesResult.recordset);

    // For each table, get columns
    for (const table of tablesResult.recordset) {
      const fullTableName = `${table.SchemaName}.${table.TableName}`;
      console.log(`\n=== TABLE: ${fullTableName} ===`);

      // Get columns
      const columnsResult = await sql.query`
        SELECT 
          c.name AS ColumnName,
          t.name AS DataType,
          c.max_length AS MaxLength,
          c.precision AS Precision,
          c.scale AS Scale,
          c.is_nullable AS IsNullable,
          OBJECT_DEFINITION(c.default_object_id) AS DefaultValue,
          CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END AS IsPrimaryKey
        FROM 
          sys.columns c
          INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
          INNER JOIN sys.tables tbl ON c.object_id = tbl.object_id
          INNER JOIN sys.schemas s ON tbl.schema_id = s.schema_id
          LEFT JOIN (
            SELECT 
              ic.object_id,
              ic.column_id
            FROM 
              sys.indexes i
              INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
            WHERE 
              i.is_primary_key = 1
          ) pk ON c.object_id = pk.object_id AND c.column_id = pk.column_id
        WHERE 
          s.name = ${table.SchemaName}
          AND tbl.name = ${table.TableName}
        ORDER BY 
          c.column_id
      `;

      console.log("Columns:");
      for (const col of columnsResult.recordset) {
        // Format column type with length/precision/scale
        let dataType = col.DataType;
        if (['varchar', 'nvarchar', 'char', 'nchar'].includes(dataType.toLowerCase())) {
          dataType += col.MaxLength === -1 ? '(MAX)' : `(${col.MaxLength})`;
        } else if (['decimal', 'numeric'].includes(dataType.toLowerCase())) {
          dataType += `(${col.Precision}, ${col.Scale})`;
        }
        
        // Add constraints
        const constraints = [];
        if (col.IsPrimaryKey) constraints.push('PRIMARY KEY');
        if (!col.IsNullable) constraints.push('NOT NULL');
        
        console.log(`  ${col.ColumnName} ${dataType}${constraints.length > 0 ? ' ' + constraints.join(', ') : ''}`);
      }

      // Get sample data (first 3 rows)
      try {
        const dataResult = await sql.query(`SELECT TOP 3 * FROM ${fullTableName}`);
        console.log("\nSample Data (first 3 rows):");
        console.log(dataResult.recordset);
      } catch (error) {
        console.log("Error getting sample data:", error.message);
      }
    }

  } catch (err) {
    console.error("Database connection error:", err);
  } finally {
    // Close the connection
    sql.close();
    console.log("\nConnection closed");
  }
}

// Run the extraction
extractSchema().catch(err => {
  console.error("Unhandled error:", err);
  sql.close();
}); 