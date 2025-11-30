import { Connection } from 'oracledb';
import { DefaultInfo, DefaultType, Field, FieldsDictionary, Table } from '../types';
import { EXECUTE_OPTIONS } from './utils';

export async function generateTablesAndFields (client: Connection): Promise<{
  tables: Table[];
  fields: FieldsDictionary;
}> {
  const fields: FieldsDictionary = {};
  // Note: DATA_DEFAULT is LONG type which doesn't support SQL string operations
  // The oracledb driver fetches LONG as string, so we detect default type in JavaScript
  const tablesAndFieldsSql = `
    SELECT
      cols.TABLE_NAME AS "table_name",
      cols.COLUMN_NAME AS "column_name",
      cols.DATA_TYPE AS "data_type",
      cols.DATA_LENGTH AS "data_length",
      cols.DATA_PRECISION AS "data_precision",
      cols.DATA_SCALE AS "data_scale",
      CASE WHEN cols.IDENTITY_COLUMN = 'YES' THEN 1 ELSE 0 END AS "identity_increment",
      CASE WHEN cols.NULLABLE = 'Y' THEN 1 ELSE 0 END AS "is_nullable",
      cols.DATA_DEFAULT AS "data_default",
      tcoms.COMMENTS AS "table_comment",
      ccoms.COMMENTS AS "column_comment"
    FROM USER_TAB_COLUMNS cols
    LEFT JOIN USER_COL_COMMENTS ccoms
      ON ccoms.COLUMN_NAME = cols.COLUMN_NAME
      AND ccoms.TABLE_NAME = cols.TABLE_NAME
    LEFT JOIN USER_TAB_COMMENTS tcoms
      ON tcoms.TABLE_NAME = cols.TABLE_NAME
  `;

  const tablesAndFieldsResult = await client.execute(tablesAndFieldsSql, [], EXECUTE_OPTIONS);
  const tableMap = tablesAndFieldsResult.rows?.reduce((acc: Record<string, Table>, row) => {
    const { table_name, table_comment } = row as any;
    if (!acc[table_name]) {
      acc[table_name] = {
        name: table_name,
        schemaName: '',
        note: table_comment ? { value: table_comment } : { value: '' },
      };
    }

    if (!fields[table_name]) fields[table_name] = [];
    const field = generateField(row as any);
    fields[table_name].push(field);

    return acc;
  }, {} as Record<string, Table>) || {};

  return {
    tables: Object.values(tableMap),
    fields,
  };
}

// Field utils

function getDefaultType (columnDefault: string | null | undefined): string {
  if (columnDefault === null || columnDefault === undefined) {
    return 'expression';
  }
  const trimmed = columnDefault.trim();
  // String defaults are wrapped in single quotes: 'value'
  if (/^'.*'$/.test(trimmed)) {
    return 'string';
  }
  // Number defaults are integers or non-scientific floats
  if (/^[0-9]+$/.test(trimmed) || /^[0-9]*\.[0-9]*$/.test(trimmed)) {
    return 'number';
  }
  return 'expression';
}

function generateField (row: Record<string, any>): Field {
  const {
    column_name,
    data_type,
    data_length,
    data_precision,
    data_scale,
    identity_increment,
    is_nullable,
    data_default,
    column_comment,
  } = row;

  const defaultType = getDefaultType(data_default);
  const dbdefault = data_default && !identity_increment ? getDbdefault(data_type, data_default, defaultType) : null;

  const fieldType = {
    type_name: getFieldType(data_type, data_length, data_precision, data_scale),
    schemaName: null,
  };

  return {
    name: column_name,
    type: fieldType,
    dbdefault,
    not_null: !is_nullable,
    increment: !!identity_increment,
    note: column_comment ? { value: column_comment } : { value: '' },
  };
}

// Field default utils

function getDbdefault (dataType: string, columnDefault: string | null, defaultType: string): DefaultInfo | null {
  if (columnDefault === null) {
    return null;
  }
  if (defaultType === 'string') {
    const trimmed = columnDefault.trim();
    return {
      value: trimmed.slice(1, -1) // slice off single quotes at the start and end of the value
        .replaceAll('\'\'', '\''), // escape sequences are preserved: in oracle, double single quotes = escape a single quote
      type: defaultType,
    };
  }

  return { value: columnDefault, type: defaultType as DefaultType };
}

// Field type utils

// These datatypes are never qualified: data size, data scale and data precision are all ignore.
// Ref: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Data-Types.html
const UNQUALIFIED_DATA_TYPES = new Set([
  // datetime
  'date',
  // number
  'binary_float',
  'binary_double',
  // long and raw
  'long',
  'long raw',
  // large object
  'blob',
  'clob',
  'nclob',
  'bfile',
  // rowid
  'rowid',
  // ansi supported
  'integer',
  'int',
  'smallint',
  'double precision',
  'real',
  // any
  'AnyData',
  'AnyType',
  'AnyDataSet',
  // xml
  'XMLType',
  'URIType',
  // spatial
  'SDO_Geometry',
  'SDO_Topo_Geometry',
  'SDO_GeoRaster',
]);

// These datatypes can be and only be qualified with data size
// For simplicity the data size in bytes is assumed
// Ref: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Data-Types.html
const SIZED_DATA_TYPES = new Set([
  // character
  'char',
  'varchar2',
  'nchar',
  'nvarchar2',
  // long and raw
  'raw',
  // rowid
  'urowid',
  // ansi supported
  'character varying',
  'character',
  'char varying',
  'nchar varying',
  'varchar',
  'national character varying',
  'national character',
  'national char varying',
  'national char',
]);

// These datatypes can be and only be qualified with precision
// For datetime, these are the types that only have 1 precision
// Ref: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Data-Types.html
const PRECISION_DATA_TYPES = new Set([
  // number
  'float',
]);

// This datatype can be qualified with a fractional second precision
const TIMESTAMP_WITH_LOCAL_TIME_ZONE_DATA_TYPE = 'timestamp with local time zone';
// This datatype can be qualified with a second precision
const TIMESTAMP_WITH_TIME_ZONE_DATA_TYPE = 'timestamp with time zone';
// This datatype can be qualified with a second precision
const TIMESTAMP_DATA_TYPE = 'timestamp';
// This datatype can be qualified with a year precision
const INTERVAL_YEAR_DATA_TYPE = 'interval year to month';
// This datatype can be qualified with a day precision and a fraction second precision
const INTERVAL_DAY_DATA_TYPE = 'interval day to second';

// These datatypes can be and only be qualified with precision and scale
// For datetime, these are the types that can have 2 precisions
// Ref: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Data-Types.html
const PRECISION_SCALED_DATA_TYPES = new Set([
  // number
  'number',
  // ansi supported
  'numeric',
  'decimal',
  'dec',
]);

function normalizeFieldType (dataType: string): string {
  const normalizedDataType = dataType.split(' ').filter(Boolean).join(' ').toLowerCase();
  switch (normalizedDataType) {
    case 'anydata':
      return 'AnyData';
    case 'anytype':
      return 'AnyType';
    case 'anydataset':
      return 'AnyDataSet';
    case 'xmltype':
      return 'XMLType';
    case 'uritype':
      return 'URIType';
    case 'sdo_geometry':
      return 'SDO_Geometry';
    case 'sdo_topo_geometry':
      return 'SDO_Topo_Geometry';
    case 'sdo_georaster':
      return 'SDO_GeoRaster';
    default:
      return normalizedDataType;
  }
}

export function getFieldType (dataType: string, characterMaximumLength: number, numericPrecision: number | null, numericScale: number | null): string {
  const normalizedDataType = normalizeFieldType(dataType);
  if (normalizedDataType === TIMESTAMP_WITH_LOCAL_TIME_ZONE_DATA_TYPE) {
    if (numericScale !== null) return `timestamp (${numericScale}) with local time zone`;
    return normalizedDataType;
  }
  if (normalizedDataType === TIMESTAMP_WITH_TIME_ZONE_DATA_TYPE) {
    if (numericScale !== null) return `timestamp (${numericScale}) with time zone`;
    return normalizedDataType;
  }
  if (normalizedDataType === TIMESTAMP_DATA_TYPE) {
    if (numericScale !== null) return `timestamp (${numericScale})`;
    return normalizedDataType;
  }
  if (normalizedDataType === INTERVAL_YEAR_DATA_TYPE) {
    if (numericPrecision !== null) return `interval year (${numericPrecision}) to month`;
    return normalizedDataType;
  }
  if (normalizedDataType === INTERVAL_DAY_DATA_TYPE) {
    if (numericPrecision !== null && numericScale !== null) return `interval day (${numericPrecision}) to second (${numericScale})`;
    if (numericPrecision !== null) return `interval day (${numericPrecision}) to second`;
    if (numericScale !== null) return `interval day to second (${numericScale})`;
    return normalizedDataType;
  }

  if (SIZED_DATA_TYPES.has(normalizedDataType)) {
    if (characterMaximumLength) return `${normalizedDataType}(${characterMaximumLength})`;
    return normalizedDataType;
  }

  if (PRECISION_DATA_TYPES.has(normalizedDataType)) {
    if (numericPrecision !== null) return `${normalizedDataType}(${numericPrecision})`;
    return normalizedDataType;
  }

  if (PRECISION_SCALED_DATA_TYPES.has(normalizedDataType)) {
    if (numericPrecision !== null && numericScale !== null) return `${normalizedDataType}(${numericPrecision}, ${numericScale})`;
    if (numericPrecision !== null) return `${normalizedDataType}(${numericPrecision})`;
    // There's no situation where numericScale is not null but numericPrecision is null
    return normalizedDataType;
  }

  // if (UNQUALIFIED_DATA_TYPES.has(normalizedDataType)) {
  //   return normalizedDataType;
  // }

  return normalizedDataType;
};
