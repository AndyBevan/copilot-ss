import * as sql from "mssql";

export class DB {
  public databaseType: string = '';
  private pool: sql.ConnectionPool;

  constructor(conn: string) {
    this.databaseType = "Microsoft Sql Server";
    this.pool = new sql.ConnectionPool(conn);
  }

  
  connect() {
    this.pool.connect();
  }

  close() {
    this.pool.close();
  }
  
  async connectAsync(): Promise<void> {
    await this.pool.connect();
  }

  async closeAsync(): Promise<void> {
    await this.pool.close();
  }

  async getTableList(): Promise<{ table_name: string }[]> {
    await this.connectAsync();
    const sqlQuery = `SELECT TABLE_NAME as table_name
                     FROM INFORMATION_SCHEMA.TABLES
                     WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_CATALOG = DB_NAME()`;
    const result = await this.pool.request().query(sqlQuery);
    return result.recordset;
  }

  async getSchema(): Promise<string> {
    await this.connectAsync();
    const sqlQuery = `SELECT TABLE_NAME as table_name, COLUMN_NAME as column_name, DATA_TYPE as data_type,
                             CHARACTER_MAXIMUM_LENGTH as character_maximum_length, COLUMN_DEFAULT as column_default,
                             IS_NULLABLE as is_nullable
                      FROM INFORMATION_SCHEMA.COLUMNS
                      WHERE TABLE_CATALOG = DB_NAME()`;
    const result = await this.pool.request().query(sqlQuery);
    return this.schemaToDDL(result.recordset);
  }

  async getTable(name: string): Promise<string> {
    await this.connectAsync();
    const sqlQuery = `SELECT TABLE_NAME as table_name, COLUMN_NAME as column_name, DATA_TYPE as data_type,
                             CHARACTER_MAXIMUM_LENGTH as character_maximum_length, COLUMN_DEFAULT as column_default,
                             IS_NULLABLE as is_nullable
                      FROM INFORMATION_SCHEMA.COLUMNS
                      WHERE TABLE_CATALOG = DB_NAME() AND TABLE_NAME = @tableName`;
    const request = this.pool.request();
    request.input("tableName", sql.NVarChar, name);
    const result = await request.query(sqlQuery);
    return this.schemaToDDL(result.recordset);
  }

  async run(sqlQuery: string): Promise<any[]> {
    await this.connectAsync();
    //sqlQuery = "SELECT Track.TrackId, Track.Name AS TrackName, Genre.Name AS GenreName FROM Track JOIN Genre ON Track.GenreId = Genre.GenreId"
    const result = await this.pool.request().query(sqlQuery);
    return result.recordset;
  }

  private schemaToDDL(schema: any[]): string {
    const tables: Record<string, any[]> = {};

    for (const row of schema) {
      if (!tables[row.table_name]) {
        tables[row.table_name] = [];
      }
      tables[row.table_name].push(row);
    }

    const ddlStatements: string[] = [];

    for (const [tableName, columns] of Object.entries(tables)) {
      const createTableSQL: string[] = [`CREATE TABLE ${tableName} (
`];

      for (const column of columns) {
        let columnSQL = `  ${column.column_name} ${column.data_type}`;

        if (column.character_maximum_length) {
          columnSQL += `(${column.character_maximum_length})`;
        }

        if (column.is_nullable === "NO") {
          columnSQL += " NOT NULL";
        }

        if (column.column_default) {
          columnSQL += ` DEFAULT ${column.column_default}`;
        }

        columnSQL += ",\n";
        createTableSQL.push(columnSQL);
      }

      createTableSQL[createTableSQL.length - 1] = createTableSQL[createTableSQL.length - 1].replace(",\n", "\n"); // Remove trailing comma
      createTableSQL.push(");");
      ddlStatements.push(createTableSQL.join(""));
    }

    return ddlStatements.join("\n\n");
  }
}

export default DB;