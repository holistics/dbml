import { Connection } from 'oracledb';
import { Ref, RefEndpoint } from '../types';
import { EXECUTE_OPTIONS, LIST_SEPARATOR } from './utils';

export async function generateRawRefs (client: Connection): Promise<Ref[]> {
  const refs: Ref[] = [];

  const refsListSql = `
    SELECT
      c.CONSTRAINT_NAME AS "fk_name",
      c.TABLE_NAME AS "child_table",
      LISTAGG(cc.COLUMN_NAME, '${LIST_SEPARATOR}') WITHIN GROUP (ORDER BY cc.POSITION) AS "child_columns",
      p.TABLE_NAME AS "parent_table",
      LISTAGG(pc.COLUMN_NAME, '${LIST_SEPARATOR}') WITHIN GROUP (ORDER BY pc.POSITION) AS "parent_columns",
      c.DELETE_RULE AS "delete_rule"
    FROM USER_CONSTRAINTS c
    JOIN USER_CONSTRAINTS p
      ON c.R_CONSTRAINT_NAME = p.CONSTRAINT_NAME
    JOIN USER_CONS_COLUMNS cc
      ON c.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
    JOIN USER_CONS_COLUMNS pc
      ON p.CONSTRAINT_NAME = pc.CONSTRAINT_NAME
      AND cc.POSITION = pc.POSITION
    LEFT JOIN USER_OBJECTS obj_child
      ON obj_child.OBJECT_NAME = c.TABLE_NAME
      AND obj_child.OBJECT_TYPE = 'TABLE'
    LEFT JOIN USER_OBJECTS obj_parent
      ON obj_parent.OBJECT_NAME = p.TABLE_NAME
      AND obj_parent.OBJECT_TYPE = 'TABLE'
    WHERE c.CONSTRAINT_TYPE = 'R'
    GROUP BY
      c.CONSTRAINT_NAME,
      c.TABLE_NAME,
      p.TABLE_NAME,
      c.DELETE_RULE,
      obj_child.CREATED,
      obj_parent.CREATED
    ORDER BY
      obj_child.CREATED,
      c.CONSTRAINT_NAME
  `;

  const refsQueryResult = await client.execute(refsListSql, [], EXECUTE_OPTIONS);
  refsQueryResult.rows?.forEach((refRow) => {
    const { fk_name, child_table, child_columns, parent_table, parent_columns, delete_rule } = refRow as Record<string, string>;

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
      onDelete: delete_rule === 'NO ACTION' ? null : delete_rule,
      onUpdate: null,
    });
  });

  return refs;
}
