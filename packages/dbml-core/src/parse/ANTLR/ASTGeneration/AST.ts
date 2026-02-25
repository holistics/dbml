export class Index {
  name: string;
  type: string;
  unique: boolean;
  pk: boolean;
  columns: { value: string; type: 'column' | 'string' | 'expression' }[];

  constructor ({
    name, unique, pk, type, columns,
  }: {
    name: string;
    unique: boolean;
    pk: boolean;
    type: string;
    columns: { value: string; type: 'column' | 'string' | 'expression' }[];
  }) {
    this.name = name;
    this.type = type;
    this.unique = unique;
    this.pk = pk;
    this.columns = columns;
  }

  toJSON (): { name: string; type: string; unique: boolean; pk: boolean; columns: { value: string; type: 'column' | 'string' | 'expression' }[] } {
    return {
      name: this.name,
      type: this.type,
      unique: this.unique,
      pk: this.pk,
      columns: this.columns,
    };
  }
}

export class Field {
  name: string;
  type: { type_name: string; schemaName: string };
  not_null: boolean;
  increment: boolean;
  dbdefault: { value: string; type: 'string' | 'number' | 'boolean' | 'expression' };
  unique: boolean;
  pk: boolean;
  note: { value: string };
  checks: { expression: string; name?: string }[];

  constructor ({
    name, type, not_null, increment, dbdefault, unique, pk, note, checks,
  }: {
    name: string;
    type: { type_name: string; schemaName: string };
    not_null: boolean;
    increment: boolean;
    dbdefault: { value: string; type: 'string' | 'number' | 'boolean' | 'expression' };
    unique: boolean;
    pk: boolean;
    note: { value: string };
    checks: { expression: string; name?: string }[];
  }) {
    this.name = name;
    this.type = type;
    this.not_null = not_null;
    this.increment = increment;
    this.dbdefault = dbdefault;
    this.unique = unique;
    this.pk = pk;
    this.note = note;
    this.checks = checks;
  }

  toJSON (): {
    name: string;
    type: { type_name: string; schemaName: string };
    not_null: boolean;
    increment: boolean;
    dbdefault: { value: string; type: 'string' | 'number' | 'boolean' | 'expression' };
    unique: boolean;
    pk: boolean;
    note: { value: string };
    checks: { expression: string; name?: string }[];
  } {
    return {
      name: this.name,
      type: this.type,
      not_null: this.not_null,
      increment: this.increment,
      dbdefault: this.dbdefault,
      unique: this.unique,
      pk: this.pk,
      note: this.note,
      checks: this.checks,
    };
  }
}

export class Table {
  name: string;
  schemaName: string;
  fields: Field[];
  indexes: Index[];
  note: { value: string };
  checks: { expression: string; name?: string }[];

  constructor ({
    name, schemaName, fields, indexes, note, checks,
  }: {
    name: string;
    schemaName: string;
    fields: Field[];
    indexes: Index[];
    note: { value: string };
    checks: { expression: string; name?: string }[];
  }) {
    this.name = name;
    this.schemaName = schemaName;
    this.fields = fields || [];
    this.indexes = indexes || [];
    this.note = note;
    this.checks = checks || [];
  }

  toJSON (): {
    name: string;
    schemaName: string;
    fields: ReturnType<Field['toJSON']>[];
    indexes: ReturnType<Index['toJSON']>[];
    note: { value: string };
    checks: { expression: string; name?: string }[];
  } {
    return {
      name: this.name,
      schemaName: this.schemaName,
      fields: this.fields?.map((f) => f.toJSON()),
      indexes: this.indexes?.map((i) => i.toJSON()),
      note: this.note,
      checks: this.checks,
    };
  }
}

export class Endpoint {
  tableName: string;
  schemaName: string;
  fieldNames: string[];
  relation: '*' | '1';

  constructor ({
    tableName, schemaName, fieldNames, relation,
  }: {
    tableName: string;
    schemaName: string;
    fieldNames: string[];
    relation: '*' | '1';
  }) {
    this.tableName = tableName;
    this.schemaName = schemaName;
    this.fieldNames = fieldNames;
    this.relation = relation;
  }

  toJSON (): { tableName: string; schemaName: string; fieldNames: string[]; relation: '*' | '1' } {
    return {
      tableName: this.tableName,
      schemaName: this.schemaName,
      fieldNames: this.fieldNames,
      relation: this.relation,
    };
  }
}

export class Ref {
  name: string;
  endpoints: Endpoint[];
  onDelete: string;
  onUpdate: string;

  constructor ({
    name, endpoints, onDelete, onUpdate,
  }: {
    name: string;
    endpoints: Endpoint[];
    onDelete: string;
    onUpdate: string;
  }) {
    this.name = name;
    this.endpoints = endpoints || [];
    this.onDelete = onDelete;
    this.onUpdate = onUpdate;
  }

  toJSON (): { name: string; onDelete: string; onUpdate: string; endpoints: ReturnType<Endpoint['toJSON']>[] } {
    return {
      name: this.name,
      onDelete: this.onDelete,
      onUpdate: this.onUpdate,
      endpoints: this.endpoints.map((e) => e.toJSON()),
    };
  }
}

export class Enum {
  name: string;
  schemaName: string;
  values: { name: string }[];

  constructor ({ name, schemaName, values }: { name: string; schemaName: string; values: { name: string }[] }) {
    this.name = name;
    this.schemaName = schemaName;
    this.values = values;
  }

  toJSON (): { name: string; schemaName: string; values: { name: string }[] } {
    return {
      name: this.name,
      schemaName: this.schemaName,
      values: this.values,
    };
  }
}

export class TableRecord {
  tableName: string;
  schemaName: string | undefined;
  columns: string[];
  values: { value: any; type: string }[];

  constructor ({
    tableName, columns, values, schemaName = undefined,
  }: {
    tableName: string;
    columns: string[];
    values: { value: any; type: string }[];
    schemaName?: string;
  }) {
    this.tableName = tableName;
    this.schemaName = schemaName;
    this.columns = columns;
    this.values = values;
  }

  toJSON (): { tableName: string; schemaName: string | undefined; columns: string[]; values: { value: any; type: string }[] } {
    return {
      tableName: this.tableName,
      schemaName: this.schemaName,
      columns: this.columns,
      values: this.values,
    };
  }
}
