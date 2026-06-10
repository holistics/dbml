import { DEFAULT_SCHEMA_NAME } from './config';
import Element from './element';

/**
 * Resolve a Dep endpoint (upstream or downstream) against the database.
 * For bare-table endpoints (fieldNames empty), returns table only.
 * For column-level endpoints, resolves each field by name.
 *
 * @param {{ schemaName?: string|null, tableName: string, fieldNames?: string[] }} endpointData
 * @param {import('./database').default} database
 * @returns {{ table: any, fields: any[] }}
 */
function resolveEndpoint (endpointData, database) {
  const schemaName = endpointData.schemaName || DEFAULT_SCHEMA_NAME;
  const table = database.findTable(schemaName, endpointData.tableName);
  if (!table) {
    return { table: null, fields: [] };
  }

  const fieldNames = endpointData.fieldNames ?? [];
  const fields = fieldNames
    .map((name) => table.findField(name))
    .filter(Boolean);
  return { table, fields };
}

class DepEdge extends Element {
  /**
   * @param {{ upstream: any, downstream: any, token?: any, dep: import('./dep').default }} param0
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
    const up = resolveEndpoint(this.upstream, database);
    const down = resolveEndpoint(this.downstream, database);
    /** @type {any} */
    this.upstreamTable = up.table;
    /** @type {any[]} */
    this.upstreamFields = up.fields;
    /** @type {any} */
    this.downstreamTable = down.table;
    /** @type {any[]} */
    this.downstreamFields = down.fields;
  }

  generateId () {
    /** @type {number} */
    this.id = this.dbState.generateId('depEdgeId');
  }

  /**
   * @param {import('./dep_edge').default} other
   * @returns {boolean}
   */
  equals (other) {
    return this.upstream.schemaName === other.upstream.schemaName
      && this.upstream.tableName === other.upstream.tableName
      && JSON.stringify(this.upstream.fieldNames) === JSON.stringify(other.upstream.fieldNames)
      && this.downstream.schemaName === other.downstream.schemaName
      && this.downstream.tableName === other.downstream.tableName
      && JSON.stringify(this.downstream.fieldNames) === JSON.stringify(other.downstream.fieldNames);
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
   * @param {any} model
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
