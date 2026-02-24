import Database from '../model_structure/database';
import {
  Table,
  Field,
  Index,
  Ref,
  Endpoint,
  Enum,
} from './ANTLR/ASTGeneration/AST';

const parseJSONToDatabase = (rawDatabase: object): Database => {
  return new Database(rawDatabase as any);
};

const createRefs = (rawRefs: any[]): ReturnType<Ref['toJSON']>[] => {
  return rawRefs.map((rawRef) => {
    const {
      name, endpoints, onDelete, onUpdate,
    } = rawRef;
    const eps = endpoints.map((ep: any) => new Endpoint(ep));
    return new Ref({
      name,
      endpoints: eps,
      onDelete,
      onUpdate,
    }).toJSON();
  });
};

const createEnums = (rawEnums: any[]): Enum[] => {
  return rawEnums.map((rawEnum) => {
    const { name, schemaName, values } = rawEnum;
    return new Enum({
      name,
      schemaName,
      values,
    });
  });
};

const createFields = (rawFields: any[], fieldsConstraints: Record<string, any>): Field[] => {
  return rawFields.map((field) => {
    const constraints = fieldsConstraints[field.name] || {};
    const f = new Field({
      name: field.name,
      type: field.type,
      dbdefault: field.dbdefault,
      not_null: field.not_null,
      increment: field.increment,
      pk: constraints.pk || field.pk,
      unique: constraints.unique || field.unique,
      note: field.note,
      checks: constraints.checks,
    });
    return f;
  });
};

const createIndexes = (rawIndexes: any[]): Index[] => {
  return rawIndexes.map((rawIndex) => {
    const {
      name, unique, pk, type, columns,
    } = rawIndex;
    const index = new Index({
      name,
      unique,
      pk,
      type,
      columns,
    });
    return index;
  });
};

const createTables = (
  rawTables: any[],
  rawFields: Record<string, any[]>,
  rawIndexes: Record<string, any[]>,
  rawTableChecks: Record<string, any>,
  tableConstraints: Record<string, any>,
): Table[] => {
  return rawTables.map((rawTable) => {
    const { name, schemaName, note } = rawTable;
    const key = schemaName ? `${schemaName}.${name}` : `${name}`;
    const constraints = tableConstraints[key] || {};
    const fields = createFields(rawFields[key], constraints);
    const indexes = createIndexes(rawIndexes[key] || []);

    return new Table({
      name,
      schemaName,
      fields,
      indexes,
      note,
      checks: rawTableChecks[key],
    });
  });
};

const generateDatabase = (schemaJson: {
  tables: any[];
  fields: Record<string, any[]>;
  indexes: Record<string, any[]>;
  refs: any[];
  enums: any[];
  tableConstraints: Record<string, any>;
  checks: Record<string, any>;
}): Database => {
  const {
    tables: rawTables,
    fields: rawFields,
    indexes: rawIndexes,
    refs: rawRefs,
    enums: rawEnums,
    tableConstraints,
    checks: rawTableChecks,
  } = schemaJson;

  try {
    const tables = createTables(rawTables, rawFields, rawIndexes, rawTableChecks, tableConstraints);
    const enums = createEnums(rawEnums);
    const refs = createRefs(rawRefs);

    const rawDatabase = {
      schemas: [],
      tables,
      refs,
      enums,
      tableGroups: [],
      aliases: [],
      project: {},
    };
    return parseJSONToDatabase(rawDatabase);
  } catch (err) {
    throw new Error(err as string);
  }
};

export {
  generateDatabase,
};
