import { Client } from 'pg';

async function getSchemaInfo (connection) {
  const client = new Client(connection);
  try {
    await client.connect();

    // Query to fetch table information
    const tableQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;
    const tableResult = await client.query(tableQuery);

    // Query to fetch column information for each table
    const tablePromises = tableResult.rows.map(async row => {
      console.log(row.table_name);
      const columnQuery = `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = $1
      `;
      const columnResult = await client.query(columnQuery, [row.table_name]);
      console.log('Columns:');
      columnResult.rows.forEach(row => {
        console.log(`${row.column_name}: ${row.data_type}`);
      });

      return {
        name: row.table_name,
        columns: columnResult.rows,
      };
    });

    // await Promise.all(tablePromises);
    const tables = await Promise.all(tablePromises);

    return {
      tables,
    };
  } catch (err) {
    console.error('Error:', err);
    return [];
  } finally {
    await client.end();
  }
}

export default class PostgresDBASTGen {
  constructor (connection) {
    this.connection = connection;
    this.data = {
      schemas: [],
      tables: [],
      refs: [],
      enums: [],
      tableGroups: [],
      aliases: [],
      project: {},
    };
  }

  async fetch () {
    const tables = await getSchemaInfo(this.connection);
    console.log(tables);
    return this.data;
  }
}
