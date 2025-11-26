import { Connection } from 'oracledb';
import { Index, IndexesDictionary } from '../types';
import { zip } from 'lodash';
import { LIST_SEPARATOR } from './utils';

export async function generateIndexes (client: Connection): Promise<IndexesDictionary> {
  const query = `
    WITH indexes AS (
        SELECT 
            i.INDEX_NAME AS index_name,
            i.TABLE_NAME AS table_name,
            CASE
              WHEN i.INDEX_TYPE ILIKE '%NORMAL' THEN 'btree' -- btree index is stored as 'NORMAL' or 'FUNCTION-BASED NORMAL'
              ELSE LOWER(REGEXP_REPLACE(i.INDEX_TYPE, '^FUNCTION-BASED ', ''))
            END AS index_type,
            CASE
              WHEN i.UNIQUENESS = 'UNIQUE' THEN 1
              ELSE 0
            END AS is_unique,
        FROM USER_INDEXES i
        WHERE NOT EXISTS (
            SELECT 1 
            FROM USER_CONSTRAINTS c
            WHERE c.INDEX_NAME = i.INDEX_NAME -- Some primary and unique constraints are backed by an index, we don't include these indexes again to avoid duplication
        )
    ),
    index_columns_and_expressions AS (
        SELECT 
            ic.INDEX_NAME AS index_name,
            ic.COLUMN_NAME AS column,
            ic.COLUMN_POSITION AS column_position,
            'column' AS column_type
        FROM USER_IND_COLUMNS ic
        
        UNION ALL

        SELECT 
            ie.INDEX_NAME AS index_name,
            ie.COLUMN_EXPRESSION AS column,
            ie.COLUMN_POSITION AS column_position,
            'expression' AS column_type
        FROM USER_IND_EXPRESSIONS ie
    ),
    index_columns_by_name AS (
        SELECT 
            ice.index_name AS index_name,
            LISTAGG(ice.column, '${LIST_SEPARATOR}') WITHIN GROUP (ORDER BY ice.column_position) AS columns,
            LISTAGG(ice.column_type, '${LIST_SEPARATOR}') WITHIN GROUP (ORDER BY ice.column_position) AS column_types
        FROM index_columns_and_expressions ice
        GROUP BY ie.INDEX_NAME
    )
    SELECT 
        i.index_name,
        i.table_name,
        icn.columns,
        icn.column_types,
        i.index_type,
        i.is_unique
    FROM indexes i
    LEFT JOIN index_columns_by_name icn
        ON i.index_name = icn.index_name
  `;

  const indexes: IndexesDictionary = {};
  const res = await client.execute(query);
  res.rows?.forEach((row) => {
    const { index_name, is_unique, table_name, columns: _columns, column_types, index_type } = row as Record<string, unknown>;
    const indexName = index_name as string || '';
    const isUnique = is_unique as boolean || false;
    const tableName = table_name as string || '';
    const columns = _columns as string || '';
    const columnTypes = column_types as string || '';
    const indexType = index_type as string || '';

    const untypedColumnList = columns.split(LIST_SEPARATOR);
    const typeList = columnTypes.split(LIST_SEPARATOR);
    const zippedColumnList = zip(untypedColumnList, typeList);

    const index: Index = {
      name: indexName,
      type: indexType,
      unique: isUnique,
      columns: zippedColumnList.map((c) => ({
        type: c[1] as 'column' | 'expression',
        value: c[0]!,
      })),
    };
    if (!indexes[tableName]) indexes[tableName] = [];
    indexes[tableName].push(index);
  });
  return indexes;
}
