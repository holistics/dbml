import { Connection } from 'oracledb';
import { Ref, RefEndpoint } from '../types';
import { EXECUTE_OPTIONS, LIST_SEPARATOR } from './utils';

export async function generateRawRefs (client: Connection): Promise<Ref[]> {
  const refs: Ref[] = [];

  const refsListSql = `
    SELECT
      c.CONSTRAINT_NAME AS FK_NAME,
      c.TABLE_NAME AS CHILD_TABLE,
      LISTAGG(cc.COLUMN_NAME, '${LIST_SEPARATOR}') WITHIN GROUP (ORDER BY cc.POSITION) AS CHILD_COLUMNS,
      p.TABLE_NAME AS PARENT_TABLE,
      LISTAGG(pc.COLUMN_NAME, '${LIST_SEPARATOR}') WITHIN GROUP (ORDER BY pc.POSITION) AS PARENT_COLUMNS,
      c.DELETE_RULE
    FROM USER_CONSTRAINTS c
    JOIN USER_CONSTRAINTS p
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

  const refsQueryResult = await client.execute(refsListSql, [], EXECUTE_OPTIONS);
  refsQueryResult.rows?.forEach((refRow) => {
    const { FK_NAME, CHILD_TABLE, CHILD_COLUMNS, PARENT_TABLE, PARENT_COLUMNS, DELETE_RULE } = refRow as Record<string, string>;

    const ep1: RefEndpoint = {
      tableName: CHILD_TABLE,
      schemaName: '',
      fieldNames: CHILD_COLUMNS.split(LIST_SEPARATOR),
      relation: '*',
    };

    const ep2: RefEndpoint = {
      tableName: PARENT_TABLE,
      schemaName: '',
      fieldNames: PARENT_COLUMNS.split(LIST_SEPARATOR),
      relation: '1',
    };

    refs.push({
      name: FK_NAME,
      endpoints: [ep1, ep2],
      onDelete: DELETE_RULE === 'NO ACTION' ? null : DELETE_RULE,
      onUpdate: null,
    });
  });

  return refs;
}
