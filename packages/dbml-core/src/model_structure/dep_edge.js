import { DEFAULT_SCHEMA_NAME } from './config';
import Element from './element';
import { shouldPrintSchema, shouldPrintSchemaName } from './utils';

class DepEdge extends Element {
  /**
   * @param {import('../../types/model_structure/dep_edge').RawDepEdge} param0
   */
  constructor ({
    upstream, downstream, token, dep,
  }) {
    super(token);
    /** @type {{ schemaName: string|null, tableName: string, fieldNames: string[] }} */
    this.upstream = {
      schemaName: upstream.schemaName ?? null,
      tableName: upstream.tableName,
      fieldNames: upstream.fieldNames ?? [],
    };
    /** @type {{ schemaName: string|null, tableName: string, fieldNames: string[] }} */
    this.downstream = {
      schemaName: downstream.schemaName ?? null,
      tableName: downstream.tableName,
      fieldNames: downstream.fieldNames ?? [],
    };
    /** @type {import('./dep').default} */
    this.dep = dep;
    /** @type {import('./dbState').default} */
    this.dbState = this.dep.dbState;
    this.generateId();

    const database = this.dep.schema.database;
    const up = this.resolveEndpoint(this.upstream, database);
    const down = this.resolveEndpoint(this.downstream, database);
    /** @type {import('./table').default | null} */
    this.upstreamTable = up.table;
    /** @type {import('./field').default[]} */
    this.upstreamFields = up.fields;
    /** @type {import('./table').default | null} */
    this.downstreamTable = down.table;
    /** @type {import('./field').default[]} */
    this.downstreamFields = down.fields;

    this.upstreamFields.forEach((field) => field.pushDepEdge(this));
    this.downstreamFields.forEach((field) => field.pushDepEdge(this));
  }

  /**
   * Resolve an upstream or downstream endpoint against the database.
   * Throws via this.error() if the referenced table or field can't be found —
   * mirrors Endpoint's strict resolution so typos in Dep produce a real
   * compile error rather than a silently-dropped edge.
   * For bare-table endpoints (fieldNames empty), returns the table only.
   *
   * @param {{ schemaName?: string|null, tableName: string, fieldNames?: string[] }} endpointData
   * @param {import('./database').default} database
   * @returns {{ table: import('./table').default, fields: import('./field').default[] }}
   */
  resolveEndpoint (endpointData, database) {
    const schemaName = endpointData.schemaName || DEFAULT_SCHEMA_NAME;
    const table = database.findTable(schemaName, endpointData.tableName);
    if (!table) {
      this.error(`Can't find table ${shouldPrintSchemaName(schemaName)
        ? `"${schemaName}".`
        : ''}"${endpointData.tableName}" referenced in Dep edge`);
    }

    const fieldNames = endpointData.fieldNames ?? [];
    const fields = fieldNames.map((name) => {
      const field = table.findField(name);
      if (!field) {
        this.error(`Can't find field ${shouldPrintSchema(table.schema)
          ? `"${table.schema.name}".`
          : ''}"${name}" in table "${table.name}" referenced in Dep edge`);
      }
      return field;
    });
    return { table, fields };
  }

  generateId () {
    /** @type {number} */
    this.id = this.dbState.generateId('depEdgeId');
  }

  export () {
    return this.shallowExport();
  }

  shallowExport () {
    return {
      upstream: this.upstream,
      downstream: this.downstream,
    };
  }

  exportParentIds () {
    return {
      depId: this.dep.id,
      upstreamTableId: this.upstreamTable ? this.upstreamTable.id : null,
      upstreamFieldIds: this.upstreamFields.map((f) => f.id),
      downstreamTableId: this.downstreamTable ? this.downstreamTable.id : null,
      downstreamFieldIds: this.downstreamFields.map((f) => f.id),
    };
  }

  /**
   * @param {import('../../types/model_structure/database').NormalizedDatabase} model
   */
  normalize (model) {
    if (!model.depEdges) model.depEdges = {};
    model.depEdges[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportParentIds(),
    };
  }
}

export default DepEdge;
