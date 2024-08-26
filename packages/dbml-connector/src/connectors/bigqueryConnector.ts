import { BigQuery } from '@google-cloud/bigquery';
import { loadCredentialFromFile, parseBigQueryCredential } from '../utils/credential-loader';
import {
  getIntersection,
  getTableSchemaKey,
  mergeFieldDictionary,
  mergeIndexDictionary,
  mergeTableConstraintDictionary,
  mergeTables,
} from '../utils/helpers';
import {
  BigQueryCredentials,
  DatabaseSchema,
  DefaultInfo,
  DefaultType,
  Field,
  FieldsDictionary,
  Index,
  IndexesDictionary,
  Table,
  TableConstraintsDictionary,
} from './types';

async function connectBigQuery(credential: BigQueryCredentials): Promise<BigQuery> {
  const client = new BigQuery({
    projectId: credential.projectId,
    credentials: {
      private_key: credential.credentials.privateKey,
      client_email: credential.credentials.clientEmail,
    },
  });

  try {
    const query = `SELECT CURRENT_DATE() as today`;
    await client.query(query);
    return client;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`BigQuery connection error: ${error.message}`);
    }

    throw error;
  }
}

function getDbDefault(
  columnDefault: string,
  defaultValueType: DefaultType | null
): DefaultInfo | null {
  if (defaultValueType === null) {
    return null;
  }

  if (defaultValueType === 'string') {
    // bigquery store the double qoutes and quotes at the end and the beginning of the string: "string" or 'string'
    return { value: columnDefault.slice(1, -1).replaceAll("'", "\'"), type: defaultValueType }
  }

  return { value: columnDefault, type: defaultValueType };
}

function generateField(row: any): Field {
  const {
    columnName,
    isNullable,
    dataType,
    columnDefault,
    columnDefaultType,
    columnDescription,
  } = row;

  const fieldDefaultValue = getDbDefault(columnDefault, columnDefaultType);

  const field: Field = {
    name: columnName,
    not_null: isNullable === 'NO',
    type: {
      type_name: dataType,
      schemaName: null,
    },
    note: {
      value: columnDescription || '',
    },
    dbdefault: fieldDefaultValue,
    increment: false, // bigquery does not support native auto-increment
  };

  return field;
}

async function generateTablesAndFields(
  client: BigQuery,
  projectId: string,
  datasetId: string
): Promise<{
  tables: Table[];
  fieldMap: FieldsDictionary;
}> {
  const tableName = `${projectId}.${datasetId}`;

  const query = `
    with
      table_comments as (
        select table_schema, table_name, option_value as description
        from ${tableName}.INFORMATION_SCHEMA.TABLE_OPTIONS
        where option_name = 'description'
      ),
      column_comments as (
        select column_name, table_schema, table_name, description
        from ${tableName}.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS
        where column_name = field_path
      )
    select
      t.table_schema as tableSchema,
      t.table_name as tableName,
      (select description from table_comments tc where tc.table_name = t.table_name and tc.table_schema = t.table_schema) as tableDescription,
      (
        select description
        from column_comments cc
        where cc.table_name = c.table_name and cc.table_schema = c.table_schema and cc.column_name = c.column_name
      ) as columnDescription,
      c.column_name as columnName,
      c.is_nullable as isNullable,
      c.data_type as dataType,
      c.column_default as columnDefault,
      CASE
        WHEN SAFE_CAST(c.column_default AS FLOAT64) IS NOT NULL THEN 'number'
        WHEN SAFE_CAST(c.column_default AS BOOLEAN) IS NOT NULL THEN 'boolean'
        -- string value is enclosed in single quotes, double quotes
        WHEN REGEXP_CONTAINS(c.column_default, r"^['\\"].*['\\"]$") THEN 'string'
        WHEN c.column_default = "NULL" THEN NULL
        ELSE 'expression'
      END AS columnDefaultType
    from ${tableName}.INFORMATION_SCHEMA.TABLES t
    join ${tableName}.INFORMATION_SCHEMA.COLUMNS c
    on
      t.table_schema = c.table_schema
      and t.table_name = c.table_name
    where t.table_type = 'BASE TABLE'
    order by t.table_name, c.ordinal_position;
  `;

  const [queryResult] = await client.query({
    query,
    params: {
      // stringRegex: STRING_REGEX,
    },
  });

  const tableMap: Record<string, Table> = {};
  const fieldMap: FieldsDictionary = {};

  queryResult.forEach((row) => {
    const { tableSchema, tableName, tableComment } = row;

    const key = getTableSchemaKey(tableSchema, tableName);

    if (!tableMap[key]) {
      tableMap[key] = {
        name: tableName,
        note: { value: tableComment || '' },
        schemaName: tableSchema,
      };
    }

    if (!fieldMap[key]) {
      fieldMap[key] = [];
    }

    const field = generateField(row);
    fieldMap[key].push(field);
  });

  return {
    tables: Object.values(tableMap),
    fieldMap,
  };
}

async function generateIndexes(
  client: BigQuery,
  projectId: string,
  datasetId: string
): Promise<IndexesDictionary> {
  const tableName = `${projectId}.${datasetId}`;

  const query = `
    select
      s.index_schema as indexSchema,
      s.table_name as tableName,
      s.index_name as indexName,
      string_agg(sc.index_column_name, ', ') as indexColumnNames
    from ${tableName}.INFORMATION_SCHEMA.SEARCH_INDEXES s
    join ${tableName}.INFORMATION_SCHEMA.SEARCH_INDEX_COLUMNS sc
    on
      s.index_schema = sc.index_schema
      and s.table_name = sc.table_name
      and s.index_name = sc.index_name
    where sc.index_column_name = sc.index_field_path
    group by s.index_schema, s.table_name, s.index_name
    order by s.table_name, s.index_name;
  `;

  const [queryResult] = await client.query(query);

  const indexMap: IndexesDictionary = {};

  queryResult.forEach((row) => {
    const { indexSchema, tableName, indexName, indexColumnNames } = row;

    const indexColumns = indexColumnNames.split(', ').map((column: string) => {
      return {
        type: 'column',
        value: column,
      };
    });

    const index: Index = {
      name: indexName,
      type: '',
      columns: [...indexColumns],
    };

    const key = getTableSchemaKey(indexSchema, tableName);

    if (indexMap[key]) {
      indexMap[key].push(index);
    } else {
      indexMap[key] = [index];
    }
  });
  return indexMap;
}

async function generateTableConstraints(
  client: BigQuery,
  projectId: string,
  datasetId: string
): Promise<{
  inlinePrimaryKeyMap: TableConstraintsDictionary;
  compositePrimaryKeyMap: IndexesDictionary;
}> {
  const tableName = `${projectId}.${datasetId}`;

  const query = `
    select
      tc.table_schema as tableSchema,
      tc.table_name as tableName,
      tc.constraint_name as constraintName,
      string_agg(kcu.column_name, ', ') as columnNames,
      count(kcu.column_name) as columnCount,
    from ${tableName}.INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    join ${tableName}.INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
    on
      tc.table_schema = kcu.table_schema
      and tc.table_name = kcu.table_name
      and tc.constraint_name = kcu.constraint_name
    where tc.constraint_type = 'PRIMARY KEY'
    group by tc.table_schema, tc.table_name, tc.constraint_name
    order by tc.table_name, tc.constraint_name;
  `;

  const [queryResult] = await client.query(query);

  const inlinePrimaryKeyList = queryResult.filter(
    (row) => row.columnCount && row.columnCount === 1
  );
  const compositePrimaryKeyList = queryResult.filter(
    (row) => row.columnCount && row.columnCount > 1
  );

  const inlinePrimaryKeyMap: TableConstraintsDictionary = {};
  inlinePrimaryKeyList.forEach((inlineKey) => {
    const { tableSchema, tableName, columnNames } = inlineKey;

    const key = getTableSchemaKey(tableSchema, tableName);

    if (!inlinePrimaryKeyMap[key]) {
      inlinePrimaryKeyMap[key] = {};
    }

    if (!inlinePrimaryKeyMap[key][columnNames]) {
      inlinePrimaryKeyMap[key][columnNames] = {};
    }

    inlinePrimaryKeyMap[key][columnNames].pk = true;
  });

  const compositePrimaryKeyMap: IndexesDictionary = {};
  compositePrimaryKeyList.forEach((compositeKey) => {
    const { tableSchema, tableName, constraintName, columnNames } = compositeKey;

    const indexColumns = columnNames.split(', ').map((column: string) => {
      return {
        type: 'column',
        value: column,
      };
    });

    const index: Index = {
      name: constraintName,
      type: '',
      columns: [...indexColumns],
      pk: true,
    };

    const key = getTableSchemaKey(tableSchema, tableName);

    if (compositePrimaryKeyMap[key]) {
      compositePrimaryKeyMap[key].push(index);
    } else {
      compositePrimaryKeyMap[key] = [index];
    }
  });

  return {
    inlinePrimaryKeyMap,
    compositePrimaryKeyMap,
  };
}

async function validateDatasetIdList(client: BigQuery, datasetIdList: string[]): Promise<string[]> {
  const [datasets] = await client.getDatasets();

  const rawDatasetIdList = datasets.map((dataset) => dataset.id).filter((id) => id) as string[];

  // If user does not specify which datasets to be fetched, we will fetch all datasets
  if (datasetIdList.length === 0) {
    return rawDatasetIdList;
  }
  return getIntersection(datasetIdList, rawDatasetIdList);
}

async function fetchSchemaJsonByDataset(
  client: BigQuery,
  projectId: string,
  datasetId: string
): Promise<DatabaseSchema> {
  const res = await Promise.all([
    generateTablesAndFields(client, projectId, datasetId),
    generateIndexes(client, projectId, datasetId),
    generateTableConstraints(client, projectId, datasetId),
  ]);

  const { tables, fieldMap } = res[0];
  const indexMap = res[1];
  const { inlinePrimaryKeyMap, compositePrimaryKeyMap } = res[2];

  return {
    tables,
    fields: fieldMap,
    refs: [],
    enums: [],
    indexes: mergeIndexDictionary(indexMap, compositePrimaryKeyMap),
    tableConstraints: inlinePrimaryKeyMap,
  };
}

async function fetchSchemaJson(keyFilename: string): Promise<DatabaseSchema> {
  const rawCredential = await loadCredentialFromFile(keyFilename);
  const credentialJson = parseBigQueryCredential(rawCredential);
  const client = await connectBigQuery(credentialJson);

  const projectId = await client.getProjectId();
  const datasetIdList = await validateDatasetIdList(client, credentialJson.datasets);

  const querySchemaPromises = datasetIdList.map((dataset) =>
    fetchSchemaJsonByDataset(client, projectId, dataset)
  );

  const databaseSchemaRes = await Promise.all(querySchemaPromises);

  const res = databaseSchemaRes.reduce((acc, dbSchema) => {
      const { tables, fields, indexes, tableConstraints } = dbSchema;

      acc.tables = mergeTables(acc.tables, tables);
      acc.fields = mergeFieldDictionary(acc.fields, fields);
      acc.indexes = mergeIndexDictionary(acc.indexes, indexes);
      acc.tableConstraints = mergeTableConstraintDictionary(acc.tableConstraints, tableConstraints);

      return acc;
    },
    { tables: [], fields: {}, tableConstraints: {}, indexes: {}, refs: [], enums: [] }
  );

  return res;
}

export { fetchSchemaJson };
