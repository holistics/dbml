import { Connection } from 'oracledb';
import { Index, IndexesDictionary } from '../types';
import { EXECUTE_OPTIONS } from './utils';

export async function generateIndexes (client: Connection): Promise<IndexesDictionary> {
  const query = `
    SELECT
      i.INDEX_NAME,
      i.TABLE_NAME,
      CASE
        WHEN i.INDEX_TYPE LIKE '%NORMAL' THEN 'btree'
        ELSE LOWER(REGEXP_REPLACE(i.INDEX_TYPE, '^FUNCTION-BASED ', ''))
      END AS INDEX_TYPE,
      CASE WHEN i.UNIQUENESS = 'UNIQUE' THEN 1 ELSE 0 END AS IS_UNIQUE,
      ic.COLUMN_NAME,
      ic.COLUMN_POSITION,
      ie.COLUMN_EXPRESSION
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
    const { INDEX_NAME, TABLE_NAME, INDEX_TYPE, IS_UNIQUE, COLUMN_NAME, COLUMN_EXPRESSION } = row as Record<string, unknown>;

    const name = INDEX_NAME as string;
    const table = TABLE_NAME as string;
    const type = INDEX_TYPE as string;
    const unique = !!(IS_UNIQUE as number);

    if (COLUMN_EXPRESSION) {
      if (!indexMap[name]) {
        indexMap[name] = { table, type, unique, columns: [] };
      }
      indexMap[name].columns.push({ type: 'expression', value: COLUMN_EXPRESSION as string });
      return;
    }
    if (COLUMN_NAME) {
      if (!indexMap[name]) {
        indexMap[name] = { table, type, unique, columns: [] };
      }
      indexMap[name].columns.push({ type: 'column', value: COLUMN_NAME as string });
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
