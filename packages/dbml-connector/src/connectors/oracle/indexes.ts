import { Connection } from 'oracledb';
import { Index, IndexesDictionary } from '../types';
import { EXECUTE_OPTIONS } from './utils';

export async function generateIndexes (client: Connection): Promise<IndexesDictionary> {
  const query = `
    SELECT
      LOWER(i.INDEX_NAME) AS "index_name",
      LOWER(i.TABLE_NAME) AS "table_name",
      CASE
        WHEN i.INDEX_TYPE LIKE '%NORMAL' THEN 'btree'
        ELSE LOWER(REGEXP_REPLACE(i.INDEX_TYPE, '^FUNCTION-BASED ', ''))
      END AS "index_type",
      CASE WHEN i.UNIQUENESS = 'UNIQUE' THEN 1 ELSE 0 END AS "is_unique",
      LOWER(ic.COLUMN_NAME) AS "column_name",
      ic.COLUMN_POSITION AS "column_position",
      ie.COLUMN_EXPRESSION AS "column_expression"
    FROM USER_INDEXES i
    LEFT JOIN USER_IND_COLUMNS ic
      ON i.INDEX_NAME = ic.INDEX_NAME
    LEFT JOIN USER_IND_EXPRESSIONS ie
      ON i.INDEX_NAME = ie.INDEX_NAME
      AND ic.COLUMN_POSITION = ie.COLUMN_POSITION
    WHERE NOT EXISTS (
      SELECT 1
      FROM USER_CONSTRAINTS c
      WHERE c.INDEX_NAME = i.INDEX_NAME
    )
    ORDER BY i.INDEX_NAME, ic.COLUMN_POSITION
  `;

  const res = await client.execute(query, [], EXECUTE_OPTIONS);

  const indexes: IndexesDictionary = {};
  const indexMap: Record<string, { table: string; type: string; unique: boolean; columns: Array<{ type: 'column' | 'expression'; value: string }> }> = {};

  res.rows?.forEach((row) => {
    const { index_name, table_name, index_type, is_unique, column_name, column_expression } = row as Record<string, unknown>;

    const name = index_name as string;
    const table = table_name as string;
    const type = index_type as string;
    const unique = !!(is_unique as number);

    if (column_expression) {
      if (!indexMap[name]) {
        indexMap[name] = { table, type, unique, columns: [] };
      }
      indexMap[name].columns.push({ type: 'expression', value: column_expression as string });
      return;
    }
    if (column_name) {
      if (!indexMap[name]) {
        indexMap[name] = { table, type, unique, columns: [] };
      }
      indexMap[name].columns.push({ type: 'column', value: column_name as string });
      return;
    }
  });

  Object.entries(indexMap).forEach(([name, { table, type, unique, columns }]) => {
    const index: Index = { name, type, unique, columns };
    if (!indexes[table]) indexes[table] = [];
    indexes[table].push(index);
  });

  return indexes;
}
