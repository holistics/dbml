import Element from './element';

class Dep extends Element {
  constructor ({
    name, note, downstreamTable, upstreamTables, fieldDeps, ctes, token, db,
  } = {}) {
    super(token);
    this.name = name;
    this.note = note?.value;
    this.noteToken = note?.token;
    this.upstreamTables = [];
    this.db = db;
    this.dbState = db.dbState;

    this.processDownstreamTable(downstreamTable);

    // Process CTEs first, before upstream tables
    if (ctes && ctes.length > 0) {
      this.processCtes(ctes, downstreamTable);
    }

    this.processUpstreamTables(upstreamTables, downstreamTable);

    this.fieldDeps = [];
    this.processFieldDeps(fieldDeps);

    this.generateId();
  }

  generateId () {
    this.id = this.dbState.generateId('depId');
  }

  processDownstreamTable (table) {
    this.downstreamTable = this.db.findTable(table.schema, table.table);
  }

  processCtes (ctes, downstreamTable) {
    // Add CTEs to database, scoped by downstream table
    ctes.forEach((cte) => {
      this.db.addCte(downstreamTable.schema, downstreamTable.table, cte.name, cte);
    });
  }

  resolveTableOrCte (schema, tableName, downstreamTable) {
    // First, try to find as a regular table
    const table = this.db.findTable(schema, tableName);
    if (table) {
      return { table, isCte: false };
    }

    // If not found, check if it's a CTE scoped to this downstream table
    const cte = this.db.findCte(downstreamTable.schema, downstreamTable.table, tableName);
    if (cte) {
      // Recursively resolve CTE's upstream tables
      const resolvedUpstream = [];
      cte.upstreamTables.forEach((upstreamRef) => {
        const resolved = this.resolveTableOrCte(
          upstreamRef.schema,
          upstreamRef.table,
          downstreamTable,
        );
        if (resolved.table) {
          resolvedUpstream.push(resolved.table);
        } else if (resolved.upstream) {
          resolvedUpstream.push(...resolved.upstream);
        }
      });
      return { upstream: resolvedUpstream, isCte: true };
    }

    return { table: null, isCte: false };
  }

  processUpstreamTables (tables, downstreamTable) {
    tables.forEach((table) => {
      const resolved = this.resolveTableOrCte(table.schema, table.table, downstreamTable);

      if (resolved.table) {
        // It's a regular table
        this.upstreamTables.push(resolved.table);
      } else if (resolved.upstream && resolved.upstream.length > 0) {
        // It's a CTE - add all its resolved upstream tables
        resolved.upstream.forEach(t => {
          // Avoid duplicates
          if (!this.upstreamTables.includes(t)) {
            this.upstreamTables.push(t);
          }
        });
      } else {
        const tableRef = table.schema ? `${table.schema}.${table.table}` : table.table;
        console.warn(`Dependency references non-existent table: ${tableRef}`);
      }
    });
  }

  processFieldDeps (fieldDeps) {
    if (!fieldDeps) return;
    fieldDeps.forEach((_fieldDep) => {
      const {
        downstreamField, upstreamFields, note, name,
      } = _fieldDep;
      const fieldDep = {};
      fieldDep.downstreamField = this.downstreamTable.findField(downstreamField);

      // Skip if downstream field doesn't exist
      if (!fieldDep.downstreamField) {
        console.warn(`Field dependency references non-existent downstream field: ${downstreamField} in table ${this.downstreamTable.name}`);
        return;
      }

      fieldDep.name = name;
      fieldDep.note = note?.value;
      fieldDep.noteToken = note?.token;
      fieldDep.upstreamFields = [];

      upstreamFields.forEach((upstreamField) => {
        const { ownerTableIdx, field } = upstreamField;
        const upstreamTable = this.upstreamTables[ownerTableIdx];
        // Skip if upstream table doesn't exist (already filtered in processUpstreamTables)
        if (upstreamTable) {
          const foundField = upstreamTable.findField(field);
          if (foundField) {
            fieldDep.upstreamFields.push(foundField);
          }
        }
      });

      // Only add field dep if it has at least one upstream field
      if (fieldDep.upstreamFields.length > 0) {
        this.fieldDeps.push(fieldDep);
      }
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
      fieldDeps: this.fieldDeps.map((dep) => ({
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
      downstreamTable: this.downstreamTable.id,
      upstreamTables: this.upstreamTables.map((upstreamTable) => upstreamTable.id),
      fieldDeps: this.fieldDeps.map((dep) => ({
        downstreamField: dep.downstreamField.id,
        upstreamFields: dep.upstreamFields.map((field) => field.id),
        note: dep.note,
        name: dep.name,
      })),
    };
  }
}

export default Dep;
