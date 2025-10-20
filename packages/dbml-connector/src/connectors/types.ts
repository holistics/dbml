import { columns } from "mssql";

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

interface CheckConstraint {
  name?: string;
  expression: string;
}

interface TableConstraint {
  fields: {
    [fieldName: string]: {
      pk?: boolean;
      unique?: boolean;
      checks: CheckConstraint[];
    };
  };
  checks: CheckConstraint[];
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
  projectId?: string,
  credentials?: {
    clientEmail: string,
    privateKey: string,
  },
  datasets: string[],
}

// Currently, we parse the check constraints as enum values in mssql.
// However, one check constraint can have multiple set of enum values.
// So, we need to store the enum values in a dictionary.
// Examples:
// CREATE TABLE AddressInfo (
//   A1 UNIQUEIDENTIFIER NOT NULL,
//   A2 UNIQUEIDENTIFIER NOT NULL,
//   A3 UNIQUEIDENTIFIER NOT NULL,
//   A4 UNIQUEIDENTIFIER NOT NULL,
//   CONSTRAINT CK_Address_Valid CHECK (
//       A1 IN ('1111', '2222', '333') AND
//       A2 IN ('1111', '2222') AND
//       A3 IN ('2222', '1111') AND
//       A4 IN ('2222', '3333')
//   )
// );
// GO
// In the above example, we have a check constraint CK_Address_Valid2 with 4 columns: A1, A2, A3, A4.
// Each column has a different set of enum values. So, we need to store the enum values in a dictionary.
// In the above example, the enum values dictionary will look like this:
// [
//   {
//     columns : ['A1'],
//     enumValues: [
//       { name: '1111' },
//       { name: '2222' },
//       { name: '333' }
//     ],
//     constraint_name: 'CK_Address_Valid_A1'
//   },
//   {
//     columns : ['A2, A3'], => In this case, these two columns have the same set of enum values.
//     enumValues: [
//       { name: '1111' },
//       { name: '2222' }
//     ],
//     constraint_name: 'CK_Address_Valid_A2_A3'
//   },
//   {
//     columns : ['A4'],
//     enumValues: [
//       { name: '2222' },
//       { name: '3333' }
//     ],
//     constraint_name: 'CK_Address_Valid_A4'
//   }
// ]
interface EnumValuesDict {
  columns: string[],
  enumValues: EnumValue[],
  constraint_name: string,
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
  EnumValuesDict,
};
