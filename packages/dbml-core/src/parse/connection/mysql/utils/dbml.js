/* eslint-disable no-use-before-define */
import {
  Table, Field, Enum, Index,
  Endpoint,
  Ref,
} from '../../../ANTLR/ASTGeneration/AST';

export function createEnums (enumList) {
  return enumList.map((item) => {
    const { name, values } = item;
    return new Enum({ name, values });
  });
}

export function createRefs (tableForeignKeyMap) {
  const result = [];
  Object.values(tableForeignKeyMap).forEach((tableForeignKey) => {
    const refList = Object.values(tableForeignKey).map((key) => {
      const {
        onDelete,
        onUpdate,
        foreignColumns,
        foreignTableName,
        refTableName,
        refColumns,
        name,
      } = key;

      const endpoint1 = new Endpoint({
        tableName: refTableName,
        fieldNames: refColumns,
        relation: '1',
      });

      const endpoint2 = new Endpoint({
        tableName: foreignTableName,
        fieldNames: foreignColumns,
        relation: '*',
      });

      const ref = new Ref({
        name,
        endpoints: [endpoint1, endpoint2],
      });

      if (onDelete !== 'NO ACTION') {
        ref.onDelete = onDelete;
      }

      if (onUpdate !== 'NO ACTION') {
        ref.onUpdate = onUpdate;
      }

      return ref;
    });

    result.push(...refList);
  });

  return result;
}

export function createTables (tableList, fieldMap, primaryKeyMap, uniqueConstraintMap, indexMap) {
  return tableList.map((table) => {
    const { name, schemaName, note } = table;

    const fieldList = fieldMap[name] || [];
    const indexList = indexMap[name] || [];
    const tablePrimayKey = primaryKeyMap[name] || {};
    const tableUniqueConstraintList = uniqueConstraintMap[name] || {};

    const inlineUniqueConstraintList = getInlineUniqueConstraints(tableUniqueConstraintList);
    const fieldEntityList = createFields(fieldList, tablePrimayKey, inlineUniqueConstraintList);

    const compositeUniqueConstraintList = getCompositeUniqueConstraints(tableUniqueConstraintList);
    const indexEntityList = createIndexes(Object.values(indexList), tablePrimayKey, compositeUniqueConstraintList);

    return new Table({
      name,
      schemaName,
      note,
      fields: fieldEntityList,
      indexes: indexEntityList,
    });
  });
}

// TODO: check unique
function createFields (fieldList, primaryKey, inlineUniqueConstraintList) {
  return fieldList.map((field) => {
    const {
      name, type, notNull, increment, note, dbdefault,
    } = field;

    const fieldEntity = new Field({
      name,
      type,
      not_null: notNull,
      increment,
      dbdefault,
      note,
      pk: false,
      unique: false,
    });

    if (
      Array.isArray(primaryKey.columns)
      && primaryKey.columns.length === 1
      && primaryKey.columns[0] === name
    ) {
      fieldEntity.pk = true;
    }

    const uniqueConstraint = inlineUniqueConstraintList.find((constraint) => constraint.columns[0] === name);
    if (uniqueConstraint) {
      fieldEntity.unique = true;
    }

    return fieldEntity;
  });
}

function createIndexes (indexList, primaryKey, compositeUniqueConstraintList) {
  const indexEntityList = [];

  indexList.forEach((index) => {
    const indexEntity = new Index({
      name: index.name,
      unique: index.unique,
      type: index.type,
      columns: index.columns,
      pk: false,
    });
    indexEntityList.push(indexEntity);
  });

  if (Array.isArray(primaryKey.columns) && primaryKey.columns.length > 1) {
    const indexColumnList = primaryKey.columns.map((col) => ({ value: col, type: 'column' }));

    const indexEntity = new Index({
      name: primaryKey.name,
      unique: false,
      columns: indexColumnList,
      pk: true,
    });
    indexEntityList.push(indexEntity);
  }

  compositeUniqueConstraintList.forEach((key) => {
    const indexColumnList = key.columns.map((col) => ({ value: col, type: 'column' }));

    const indexEntity = new Index({
      name: key.name,
      unique: true,
      pk: false,
      columns: indexColumnList,
    });
    indexEntityList.push(indexEntity);
  });

  return indexEntityList;
}

function getInlineUniqueConstraints (constraintMap) {
  return Object.values(constraintMap)
    .filter((constraint) => Array.isArray(constraint.columns) && constraint.columns.length === 1);
}

function getCompositeUniqueConstraints (constraintMap) {
  return Object.values(constraintMap)
    .filter((constraint) => Array.isArray(constraint.columns) && constraint.columns.length > 1);
}
