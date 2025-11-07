import * as oracledb from 'oracledb';
import {
  DefaultInfo,
  DatabaseSchema,
  DefaultType,
  Field,
  IndexColumn,
  FieldsDictionary,
  Table,
  Enum,
  IndexesDictionary,
  TableConstraintsDictionary,
  Ref,
  TypeInfo,
} from './types';
import { getEnumValues } from './sqliteConnector';

async function connectOracle (connection: string): Promise<oracledb.Connection> {
  // Parse connection string to extract connection details
  // Expected format: user/password@hostname/servicename
  const regex = /^(.*?)\/(.*)@(.*)$/;
  const match = connection.match(regex);

  if (!match) {
    throw new Error('Invalid Oracle connection string format. Expected: user/password@hostname/servicename');
  }

  const [, user, password, connectionString] = match;

  // Set connection options
  const connectionConfig: oracledb.ConnectionAttributes = {
    user,
    password,
    connectString: connectionString,
  };

  // Connect to Oracle database
  return oracledb.getConnection(connectionConfig);
}

function getDbDefault (columnDefault: string | null, defaultValueType: DefaultType): DefaultInfo | null {
  if (columnDefault === null) {
    return null;
  }

  return {
    type: defaultValueType,
    value: columnDefault,
  };
}

function getFieldType (dataType: string, dataLength: number | null, dataPrecision: number | null, dataScale: number | null): TypeInfo {
  let typeName = dataType;

  // Add precision and scale for numeric types
  if (dataType === 'NUMBER' && dataPrecision !== null) {
    if (dataScale !== null && dataScale > 0) {
      typeName = `${dataType}(${dataPrecision},${dataScale})`;
    } else {
      typeName = `${dataType}(${dataPrecision})`;
    }
  }

  // Add length for character types
  if ((['VARCHAR2', 'CHAR', 'NCHAR', 'NVARCHAR2', 'RAW'].includes(dataType)) && dataLength !== null) {
    typeName = `${dataType}(${dataLength})`;
  }

  return {
    type_name: typeName,
    schemaName: null,
  };
}

function determineDefaultValueType (dataDefault: string): DefaultType {
  if (dataDefault.startsWith("'") && dataDefault.endsWith("'")) {
    return 'string';
  }

  if (dataDefault === 'true' || dataDefault === 'false') {
    return 'boolean';
  }

  if (!Number.isNaN(dataDefault)) {
    return 'number';
  }

  return 'expression';
}

function generateField (row: any, tableName: string, columnsWithEnum: { [key: string]: Enum }): Field {
  const {
    COLUMN_NAME,
    DATA_TYPE,
    DATA_LENGTH,
    DATA_PRECISION,
    DATA_SCALE,
    NULLABLE,
    DATA_DEFAULT,
    IDENTITY_COLUMN,
    COLUMN_COMMENT,
  } = row;

  const defaultValueType: DefaultType = DATA_DEFAULT ? determineDefaultValueType(DATA_DEFAULT) : 'expression';

  // Either Oracle type or an Enum type
  let actualType = getFieldType(DATA_TYPE, DATA_LENGTH, DATA_PRECISION, DATA_SCALE);

  const key = `${tableName}.${COLUMN_NAME}`;
  if (columnsWithEnum[key]) {
    actualType = {
      type_name: columnsWithEnum[key].name,
      schemaName: columnsWithEnum[key].schemaName,
    };
  }

  return {
    name: COLUMN_NAME,
    type: actualType,
    dbdefault: getDbDefault(DATA_DEFAULT, defaultValueType),
    not_null: NULLABLE === 'N',
    increment: IDENTITY_COLUMN === 'YES',
    note: COLUMN_COMMENT ? { value: COLUMN_COMMENT } : { value: '' },
  };
}

async function generateTablesAndFields (client: oracledb.Connection, schemaName: string, columnsWithEnum: { [key: string]: Enum }):
    Promise<{ tableList: Table[]; fieldMap: FieldsDictionary }> {
  // Query to get all tables in the schema with comments
  const tableQuery = `
    SELECT 
      T.TABLE_NAME,
      C.COMMENTS AS TABLE_COMMENT
    FROM ALL_TABLES T
    LEFT JOIN ALL_TAB_COMMENTS C ON T.OWNER = C.OWNER AND T.TABLE_NAME = C.TABLE_NAME
    WHERE T.OWNER = :schemaName
    ORDER BY T.TABLE_NAME
  `;

  const tableResult = await client.execute(tableQuery, { schemaName }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  const tables = tableResult.rows || [];

  const tableList: Table[] = [];
  const fieldMap: FieldsDictionary = {};

  // Process each table
  for (const table of tables) {
    const tableName = (table as any).TABLE_NAME;
    const tableComment = (table as any).TABLE_COMMENT;

    tableList.push({
      name: tableName,
      schemaName,
      note: tableComment ? { value: tableComment } : { value: '' },
    });

    // Query to get all columns for the table with comments
    const columnQuery = `
      SELECT
        C.COLUMN_NAME,
        C.DATA_TYPE,
        C.DATA_LENGTH,
        C.DATA_PRECISION,
        C.DATA_SCALE,
        C.NULLABLE,
        C.DATA_DEFAULT,
        CASE WHEN C.IDENTITY_COLUMN = 'YES' THEN 'YES' ELSE 'NO' END AS IDENTITY_COLUMN,
        CC.COMMENTS AS COLUMN_COMMENT
      FROM ALL_TAB_COLUMNS C
      LEFT JOIN ALL_COL_COMMENTS CC ON C.OWNER = CC.OWNER AND C.TABLE_NAME = CC.TABLE_NAME AND C.COLUMN_NAME = CC.COLUMN_NAME
      WHERE C.OWNER = :schemaName AND C.TABLE_NAME = :tableName
      ORDER BY C.COLUMN_ID
    `;

    const columnResult = await client.execute(columnQuery, { schemaName, tableName }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const columns = columnResult.rows || [];

    fieldMap[`${schemaName}.${tableName}`] = columns.map(row => generateField(row, tableName, columnsWithEnum));
  }

  return { tableList, fieldMap };
}

async function generateIndexes (client: oracledb.Connection, schemaName: string): Promise<IndexesDictionary> {
  const indexMap: IndexesDictionary = {};

  // Query to get all indexes in the schema
  const indexQuery = `
    SELECT
      I.TABLE_NAME,
      I.INDEX_NAME,
      I.INDEX_TYPE,
      I.UNIQUENESS,
      IC.COLUMN_NAME,
      IC.COLUMN_POSITION
    FROM ALL_INDEXES I
    JOIN ALL_IND_COLUMNS IC ON I.INDEX_NAME = IC.INDEX_NAME AND I.OWNER = IC.INDEX_OWNER
    WHERE I.OWNER = :schemaName
    ORDER BY I.TABLE_NAME, I.INDEX_NAME, IC.COLUMN_POSITION
  `;

  const indexResult = await client.execute(indexQuery, { schemaName }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  const indexRows = indexResult.rows || [];

  // Group indexes by table
  const indexesByTable: Record<string, Record<string, { unique: boolean; type: string; columns: IndexColumn[] }>> = {};

  for (const row of indexRows) {
    const {
      TABLE_NAME, INDEX_NAME, INDEX_TYPE, UNIQUENESS, COLUMN_NAME,
    } = row as any;

    if (!indexesByTable[TABLE_NAME]) {
      indexesByTable[TABLE_NAME] = {};
    }

    if (!indexesByTable[TABLE_NAME][INDEX_NAME]) {
      indexesByTable[TABLE_NAME][INDEX_NAME] = {
        unique: UNIQUENESS === 'UNIQUE',
        type: INDEX_TYPE,
        columns: [],
      };
    }

    indexesByTable[TABLE_NAME][INDEX_NAME].columns.push({
      type: 'column',
      value: COLUMN_NAME,
    });
  }

  // Convert to the expected format
  for (const tableName in indexesByTable) {
    const tableKey = `${schemaName}.${tableName}`;
    indexMap[tableKey] = [];

    for (const indexName in indexesByTable[tableName]) {
      const { unique, type, columns } = indexesByTable[tableName][indexName];

      indexMap[tableKey].push({
        name: indexName,
        type,
        unique,
        columns,
      });
    }

    // Remove empty arrays
    if (indexMap[tableKey].length === 0) {
      delete indexMap[tableKey];
    }
  }

  return indexMap;
}

async function generatePrimaryKeys (client: oracledb.Connection, schemaName: string): Promise<TableConstraintsDictionary> {
  const constraintMap: TableConstraintsDictionary = {};

  // Query to get all primary key constraints
  const pkQuery = `
    SELECT
      CON.TABLE_NAME,
      COL.COLUMN_NAME
    FROM ALL_CONSTRAINTS CON
    JOIN ALL_CONS_COLUMNS COL ON CON.CONSTRAINT_NAME = COL.CONSTRAINT_NAME AND CON.OWNER = COL.OWNER
    WHERE CON.CONSTRAINT_TYPE = 'P' AND CON.OWNER = :schemaName
    ORDER BY CON.TABLE_NAME, COL.POSITION
  `;

  const pkResult = await client.execute(pkQuery, { schemaName }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  const pkRows = pkResult.rows || [];

  // Group primary keys by table
  for (const row of pkRows) {
    const { TABLE_NAME, COLUMN_NAME } = row as any;
    const tableKey = `${schemaName}.${TABLE_NAME}`;

    if (!constraintMap[tableKey]) {
      constraintMap[tableKey] = {};
    }

    constraintMap[tableKey][COLUMN_NAME] = { pk: true };
  }

  return constraintMap;
}

async function generateForeignKeys (client: oracledb.Connection, schemaName: string): Promise<Ref[]> {
  const foreignKeyList: Ref[] = [];

  // Query to get all foreign key constraints
  const fkQuery = `
    SELECT
      AC.CONSTRAINT_NAME,
      AC.TABLE_NAME AS CHILD_TABLE,
      ACC.COLUMN_NAME AS CHILD_COLUMN,
      AC.R_CONSTRAINT_NAME,
      ACP.TABLE_NAME AS PARENT_TABLE,
      ACP.COLUMN_NAME AS PARENT_COLUMN,
      AC.DELETE_RULE
    FROM ALL_CONSTRAINTS AC
    JOIN ALL_CONS_COLUMNS ACC ON AC.CONSTRAINT_NAME = ACC.CONSTRAINT_NAME AND AC.OWNER = ACC.OWNER
    JOIN ALL_CONSTRAINTS PC ON AC.R_CONSTRAINT_NAME = PC.CONSTRAINT_NAME AND AC.R_OWNER = PC.OWNER
    JOIN ALL_CONS_COLUMNS ACP ON PC.CONSTRAINT_NAME = ACP.CONSTRAINT_NAME AND PC.OWNER = ACP.OWNER
    WHERE AC.CONSTRAINT_TYPE = 'R' AND AC.OWNER = :schemaName
    ORDER BY AC.CONSTRAINT_NAME, ACC.POSITION
  `;

  const fkResult = await client.execute(fkQuery, { schemaName }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  const fkRows = fkResult.rows || [];

  // Group foreign keys by constraint name
  const fksByConstraint: Record<string, {
    childTable: string;
    childColumns: string[];
    parentTable: string;
    parentColumns: string[];
    deleteRule: string;
  }> = {};

  for (const row of fkRows) {
    const {
      CONSTRAINT_NAME,
      CHILD_TABLE,
      CHILD_COLUMN,
      PARENT_TABLE,
      PARENT_COLUMN,
      DELETE_RULE,
    } = row as any;

    if (!fksByConstraint[CONSTRAINT_NAME]) {
      fksByConstraint[CONSTRAINT_NAME] = {
        childTable: CHILD_TABLE,
        childColumns: [],
        parentTable: PARENT_TABLE,
        parentColumns: [],
        deleteRule: DELETE_RULE,
      };
    }

    fksByConstraint[CONSTRAINT_NAME].childColumns.push(CHILD_COLUMN);
    fksByConstraint[CONSTRAINT_NAME].parentColumns.push(PARENT_COLUMN);
  }

  // Convert to the expected format
  for (const constraintName in fksByConstraint) {
    const {
      childTable,
      childColumns,
      parentTable,
      parentColumns,
      deleteRule,
    } = fksByConstraint[constraintName];

    const endpoint1 = {
      tableName: childTable,
      schemaName,
      fieldNames: childColumns,
      relation: '*' as const,
    };

    const endpoint2 = {
      tableName: parentTable,
      schemaName,
      fieldNames: parentColumns,
      relation: '1' as const,
    };

    foreignKeyList.push({
      name: constraintName,
      endpoints: [endpoint1, endpoint2],
      onDelete: deleteRule === 'NO ACTION' ? null : deleteRule.toLowerCase(),
      onUpdate: null, // Oracle doesn't support ON UPDATE actions
    });
  }

  return foreignKeyList;
}

async function generateEnums (client: oracledb.Connection, schemaName: string): Promise<{ enumList: Enum[], columnsWithEnum: { [key: string]: Enum } }> {
  // Oracle doesn't have native enum types, but we can check for check constraints that might represent enums
  const enumList: Enum[] = [];
  const columnsWithEnum: { [key: string]: Enum } = {};

  // Query to get check constraints using DBMS_METADATA.GET_DDL to avoid LONG datatype issues
  const checkQuery = `
    SELECT
      CON.TABLE_NAME,
      CON.CONSTRAINT_NAME,
      CON.SEARCH_CONDITION,
      COL.COLUMN_NAME
    FROM ALL_CONSTRAINTS CON
    JOIN ALL_CONS_COLUMNS COL ON CON.CONSTRAINT_NAME = COL.CONSTRAINT_NAME AND CON.OWNER = COL.OWNER
    WHERE CON.CONSTRAINT_TYPE = 'C' AND CON.OWNER = :schemaName
  `;

  const checkResult = await client.execute(checkQuery, { schemaName }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  const checkRows = checkResult.rows || [];

  for (const row of checkRows) {
    const {
      TABLE_NAME, COLUMN_NAME, SEARCH_CONDITION, CONSTRAINT_NAME,
    } = row as any;

    // Use getEnumValues from sqliteConnector to extract enum values
    const enumValuesByColumns = getEnumValues(SEARCH_CONDITION, CONSTRAINT_NAME);

    if (enumValuesByColumns.length > 0) {
      for (const item of enumValuesByColumns) {
        // Check if any of the columns in the enum match the current column
        // This is needed because Oracle constraints can span multiple columns
        if (!item.columns.some(col => col.toUpperCase() === COLUMN_NAME)) {
          continue;
        }

        const enumObj: Enum = {
          name: item.constraint_name,
          schemaName,
          values: item.enumValues,
        };

        enumList.push(enumObj);
        const key = `${TABLE_NAME}.${COLUMN_NAME}`;
        columnsWithEnum[key] = enumObj;
      }
    }
  }

  return { enumList, columnsWithEnum };
}

async function fetchSchemaJson (connection: string): Promise<DatabaseSchema> {
  let client: oracledb.Connection | null = null;

  try {
    client = await connectOracle(connection);

    // Get the schema name from the connection (user name in Oracle)
    const schemaName = client.user?.toUpperCase();
    if (!schemaName) {
      throw new Error('Cannot get schema name from the connection');
    }

    // First, get the enums and columns with enum types
    const { enumList, columnsWithEnum } = await generateEnums(client, schemaName);

    // Then, get the rest of the schema data
    const [
      { tableList, fieldMap },
      indexMap,
      constraintMap,
      foreignKeyList,
    ] = await Promise.all([
      generateTablesAndFields(client, schemaName, columnsWithEnum),
      generateIndexes(client, schemaName),
      generatePrimaryKeys(client, schemaName),
      generateForeignKeys(client, schemaName),
    ]);

    return {
      tables: tableList,
      fields: fieldMap,
      refs: foreignKeyList,
      enums: enumList,
      indexes: indexMap,
      tableConstraints: constraintMap,
    };
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (error) {
        console.error('Error closing Oracle connection:', error);
      }
    }
  }
}

export {
  fetchSchemaJson,
};
