import { Connection } from 'oracledb';
import { Ref, RefEndpoint } from '../types';
import { LIST_SEPARATOR } from './utils';

export async function generateRawRefs (client: Connection): Promise<Ref[]> {
  const refs: Ref[] = [];

  const refsListSql = `
    SELECT 
        c.CONSTRAINT_NAME AS fk_name,
        c.TABLE_NAME AS child_table,
        LISTAGG(cc.COLUMN_NAME, '${LIST_SEPARATOR}') WITHIN GROUP (ORDER BY cc.POSITION) AS child_columns,
        p.table_name AS parent_table,
        LISTAGG(pc.COLUMN_NAME, '${LIST_SEPARATOR}') WITHIN GROUP (ORDER BY pc.POSITION) AS parent_columns,
        c.DELETE_RULE AS on_delete
    FROM USER_CONSTRAINTS c -- the referencing constraint
    JOIN USER_CONSTRAINTS p  -- the referenced constraint
        ON c.R_CONSTRAINT_NAME = p.CONSTRAINT_NAME
    JOIN USER_CONS_COLUMNS cc 
        ON c.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
    JOIN USER_CONS_COLUMNS pc 
        ON p.CONSTRAINT_NAME = pc.CONSTRAINT_NAME
        AND cc.POSITION = pc.POSITION
    WHERE c.CONSTRAINT_TYPE = 'R'
    GROUP BY 
        c.CONSTRAINT_NAME,
        c.TABLE_NAME,
        p.TABLE_NAME,
        c.DELETE_RULE
  `;

  const refsQueryResult = await client.execute(refsListSql);
  refsQueryResult.rows?.forEach((refRow) => {
    const {
      fk_name,
      child_table,
      child_columns,
      parent_table,
      parent_columns,
      on_delete,
    } = refRow as Record<string, string>;

    const ep1: RefEndpoint = {
      tableName: child_table,
      schemaName: '',
      fieldNames: child_columns.split(LIST_SEPARATOR),
      relation: '*',
    };

    const ep2: RefEndpoint = {
      tableName: parent_table,
      schemaName: '',
      fieldNames: parent_columns.split(LIST_SEPARATOR),
      relation: '1',
    };

    refs.push({
      name: fk_name,
      endpoints: [ep1, ep2],
      onDelete: on_delete === 'NO ACTION' ? null : on_delete,
      // oracle does not support ON UPDATE referential action
      onUpdate: null,
    });
  });

  return refs;
}
