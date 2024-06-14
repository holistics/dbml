const oracleDataTypes = [
  //character data types
  'CHAR',
  'VARCHAR2',
  'NCHAR',
  'NVARCHAR2',
  //number data types
  'NUMBER',
  'FLOAT',
  'BINARY_FLOAT',
  'BINARY_DOUBLE',
  //long and raw data types
  'LONG',
  'LONG RAW',
  'RAW',
  //datetime data types
  'DATE',
  'TIMESTAMP',
  'TIMESTAMP WITH TIME ZONE',
  'TIMESTAMP WITH LOCAL TIME ZONE',
  'INTERVAL YEAR',
  'INTERVAL YEAR TO MONTH',
  'INTERVAL DAY',
  'INTERVAL DAY TO SECOND',
  //large object data types
  'BLOB',
  'CLOB',
  'NCLOB',
  'BFILE',
  //rowid data types
  'ROWID',
  'UROWID',
  //ANSI supported data types
  'CHARACTER',
  'CHARACTER VARYING',
  'CHAR VARYING',
  'NCHAR VARYING',
  'VARCHAR',
  'NATIONAL CHARACTER',
  'NATIONAL CHARACTER VARYING',
  'NATIONAL CHAR',
  'NATIONAL CHAR VARYING',
  'NUMERIC',
  'DECIMAL',
  'DEC',
  'INTEGER',
  'INT',
  'SMALLINT',
  'FLOAT',
  'DOUBLE PRECISION',
  'REAL',
  //any types
  'SYS.ANYDATA',
  'SYS.ANYTYPE',
  'SYS.ANYDATASET',
  //XML types
  'XMLTYPE',
  'URITYPE',
  //spatial types
  'SDO_GEOMETRY',
  'SDO_TOPO_GEOMETRY',
  'SDO_GEORASTER',
];

module.exports = oracleDataTypes;
