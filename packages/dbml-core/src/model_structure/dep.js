import Element from './element';

class Dep extends Element {
  constructor ({
    name, note, downstreamTable, upstreamTables, fieldDeps, token, db,
  } = {}) {
    super(token);
    this.name = name;
    this.note = note?.value;
    this.noteToken = note?.token;
    this.upstreamTables = [];
    this.db = db;
    this.dbState = db.dbState;

    this.processDownstreamTable(downstreamTable);
    this.processUpstreamTables(upstreamTables);

    if (fieldDeps === '*') this.fieldDeps = '*';
    else {
      this.fieldDeps = [];
      this.processFieldDeps(fieldDeps);
    }

    this.generateId();
  }

  generateId () {
    this.id = this.dbState.generateId('depId');
  }

  processDownstreamTable (table) {
    this.downstreamTable = this.db.findTable(table.schema, table.table);
  }

  processUpstreamTables (tables) {
    tables.forEach((table) => {
      this.upstreamTables.push(this.db.findTable(table.schema, table.table));
    });
  }

  processFieldDeps (fieldDeps) {
    fieldDeps.forEach((_fieldDep) => {
      const {
        downstreamField, upstreamFields, note, name,
      } = _fieldDep;
      const fieldDep = {};
      fieldDep.downstreamField = this.downstreamTable.findField(downstreamField);
      fieldDep.name = name;
      fieldDep.note = note?.value;
      fieldDep.noteToken = note?.token;
      fieldDep.upstreamFields = [];

      upstreamFields.forEach((upstreamField) => {
        const { ownerTableIdx, field } = upstreamField;
        const upstreamTable = this.upstreamTables[ownerTableIdx];
        fieldDep.upstreamFields.push(upstreamTable.findField(field));
      });
      this.fieldDeps.push(fieldDep);
    });
  }

  export () {
    return {
      ...this.shallowExport(),
    };
  }

  shallowExport () {
    return {
      name: this.name,
      note: this.note,
      downstreamTable: {
        schema: this.downstreamTable.schema.name,
        table: this.downstreamTable.name,
      },
      upstreamTables: this.upstreamTables.map((upstreamTable) => ({
        schema: upstreamTable.schema.name,
        table: upstreamTable.name,
      })),
      fieldDeps: this.fieldDeps === '*' ? '*' : this.fieldDeps.map((dep) => ({
        downstreamField: dep.field.name,
        upstreamFields: dep.upstreamFields.map((field) => ({
          schema: field.table.schema.name,
          table: field.table.name,
          field: field.name,
        })),
        note: dep.note,
        name: dep.name,
      })),
    };
  }

  normalize (model) {
    model.deps[this.id] = {
      id: this.id,
      name: this.name,
      note: this.note,
      downstreamTable: {
        schema: this.downstreamTable.schema.id,
        table: this.downstreamTable.id,
      },
      upstreamTables: this.upstreamTables.map((upstreamTable) => ({
        schema: upstreamTable.schema.id,
        table: upstreamTable.id,
      })),
      fieldDeps: this.fieldDeps === '*' ? '*' : this.fieldDeps.map((dep) => ({
        downstreamField: dep.downstreamField.id,
        upstreamFields: dep.upstreamFields.map((field) => field.id),
        note: dep.note,
        name: dep.name,
      })),
    };
  }
}

export default Dep;
