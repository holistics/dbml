import Database from '../model_structure/database';
import {
  Table,
  Field,
  Index,
  Ref,
  Endpoint,
  Enum,
} from './ANTLR/ASTGeneration/AST';

const parseJSONToDatabase = (rawDatabase) => {
  const database = new Database(rawDatabase);
  return database;
};

const createRefs = (rawRefs) => {
  return rawRefs.map((rawRef) => {
    const {
      name, endpoints, onDelete, onUpdate,
    } = rawRef;
    const eps = endpoints.map((ep) => { return new Endpoint(ep); });
    return new Ref({
      name,
      endpoints: eps,
      onDelete,
      onUpdate,
    }).toJSON();
  });
};

const createEnums = (rawEnums) => {
  return rawEnums.map((rawEnum) => {
    const { name, schemaName, values } = rawEnum;
    return new Enum({
      name,
      schemaName,
      values,
    });
  });
};

const createFields = (rawFields, fieldsConstraints) => {
  return rawFields.map((field) => {
    const constraints = fieldsConstraints[field.name] || {};
    const f = new Field({
      name: field.name,
      type: field.type,
      dbdefault: field.dbdefault,
      not_null: field.not_null,
      increment: field.increment,
      pk: constraints.pk,
      unique: constraints.unique,
      note: field.note,
    });
    return f;
  });
};

const createIndexes = (rawIndexes) => {
  return rawIndexes.map((rawIndex) => {
    const {
      name, unique, primary, type, columns,
    } = rawIndex;
    const index = new Index({
      name,
      unique,
      pk: primary,
      type,
      columns,
    });
    return index;
  });
};

const createTables = (rawTables, rawFields, rawIndexes, tableConstraints) => {
  return rawTables.map((rawTable) => {
    const { name, schemaName, note } = rawTable;
    const constraints = tableConstraints[name] || {};
    const fields = createFields(rawFields[name], constraints);
    const indexes = createIndexes(rawIndexes[name] || []);

    return new Table({
      name,
      schemaName,
      fields,
      indexes,
      note,
    });
  });
};

const generateDatabase = (schemaJson) => {
  const {
    tables: rawTables,
    fields: rawFields,
    indexes: rawIndexes,
    refs: rawRefs,
    enums: rawEnums,
    tableConstraints,
  } = schemaJson;

  try {
    const tables = createTables(rawTables, rawFields, rawIndexes, tableConstraints);
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
    throw new Error(err);
  }
};

export {
  generateDatabase,
};
