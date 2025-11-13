export enum ElementKind {
  Table = 'table',
  Enum = 'enum',
  Ref = 'ref',
  Note = 'note',
  Project = 'project',
  Indexes = 'indexes',
  TableGroup = 'tablegroup',
  TablePartial = 'tablepartial',
  Check = 'checks',
  Dep = 'dep',
}

export enum SettingName {
  Color = 'color',
  HeaderColor = 'headercolor',
  Note = 'note',
  Source = 'source',

  PK = 'pk',
  PrimaryKey = 'primary key',
  Unique = 'unique',
  Ref = 'ref',
  NotNull = 'not null',
  Null = 'null',
  Increment = 'increment',
  Default = 'default',
  Name = 'name',
  Type = 'type',
  Check = 'check',

  Update = 'update',
  Delete = 'delete',
}

export enum DataSource {
  Dbt = 'dbt',
  Postgres = 'postgres',
  Snowflake = 'snowflake',
  Oracle = 'oracle',
  Mssql = 'mssql',
  Mysql = 'mysql',
}
