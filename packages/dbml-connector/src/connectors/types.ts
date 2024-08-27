interface NoteInfo {
  value: string;
}

interface TypeInfo {
  type_name: string;
  schemaName: string | null;
}


type DefaultType = 'string' | 'number' | 'boolean' | 'expression';

interface DefaultInfo {
  type: DefaultType,
  value: string;
}

interface Field {
  name: string;
  type: TypeInfo;
  dbdefault: DefaultInfo | null;
  not_null: boolean;
  increment: boolean;
  pk?: boolean;
  unique?: boolean;
  note: NoteInfo;
}

interface Table {
  name: string;
  schemaName: string;
  note: NoteInfo;
}

interface FieldsDictionary {
  [key: string]: Field[]; // Represents fields within tables, indexed by schemaName.tableName
}

interface TableConstraint {
  [fieldName: string]: {
    pk?: boolean;
    unique?: boolean;
  };
}

interface TableConstraintsDictionary {
  [tableIdentifier: string]: TableConstraint; // Represents constraints within tables, indexed by schemaName.tableName
}

interface RefEndpoint {
  tableName: string; // Parent table or child table
  schemaName: string;
  fieldNames: string[]; // The parent fields or the child fields (foreign key fields)
  relation: '*' | '1'; // The parent endpoint is '*' and the child endpoint is '1'
}

interface Ref {
  name: string;
  endpoints: RefEndpoint[]; // The first endpoint is the parent table and the second endpoint is the child table.
  onDelete: string | null;
  onUpdate: string | null;
}

interface EnumValue {
  name: string;
}

interface Enum {
  name: string;
  schemaName: string;
  values: EnumValue[];
}

interface IndexColumn {
  type: 'column' | 'expression';
  value: string;
}

interface Index {
  name: string;
  type: string;
  unique?: boolean,
  pk?: boolean,
  columns: IndexColumn[];
}

interface IndexesDictionary {
  [tableIdentifier: string]: Index[]; // Represents indexes within tables, indexed by schemaName.tableName
}

interface DatabaseSchema {
  tables: Table[];
  fields: FieldsDictionary;
  enums: Enum[];
  tableConstraints: TableConstraintsDictionary;
  refs: Ref[];
  indexes: IndexesDictionary; // Represents the indexes property
}

interface BigQueryCredentials {
  projectId: string,
  credentials: {
    clientEmail: string,
    privateKey: string,
  },
  datasets: string[],
}

export {
  NoteInfo,
  TypeInfo,
  DefaultType,
  DefaultInfo,
  Field,
  Table,
  FieldsDictionary,
  TableConstraint,
  TableConstraintsDictionary,
  RefEndpoint,
  Ref,
  EnumValue,
  Enum,
  IndexColumn,
  Index,
  IndexesDictionary,
  DatabaseSchema,
  BigQueryCredentials,
};
