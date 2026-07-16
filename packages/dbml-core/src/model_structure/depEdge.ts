import { DEFAULT_SCHEMA_NAME } from './config';
import Element from './element';
import { shouldPrintSchema, shouldPrintSchemaName } from './utils';
import type { DepEndpointData, RawDepEdge } from '../../types/model_structure/dep_edge';
import type { NormalizedModel } from '../../types/model_structure/database';
import type Dep from '../../types/model_structure/dep';
import type DbState from '../../types/model_structure/dbState';
import type Table from '../../types/model_structure/table';
import type Field from '../../types/model_structure/field';
import type Database from '../../types/model_structure/database';

class DepEdge extends Element {
  upstream: DepEndpointData;
  downstream: DepEndpointData;
  dep: Dep;
  dbState: DbState;
  id!: number;
  upstreamTable: Table | null;
  upstreamFields: Field[];
  downstreamTable: Table | null;
  downstreamFields: Field[];

  constructor ({ upstream, downstream, token, dep }: RawDepEdge) {
    super(token);
    this.upstream = {
      schemaName: upstream.schemaName ?? null,
      tableName: upstream.tableName,
      fieldNames: upstream.fieldNames ?? [],
    };
    this.downstream = {
      schemaName: downstream.schemaName ?? null,
      tableName: downstream.tableName,
      fieldNames: downstream.fieldNames ?? [],
    };
    this.dep = dep;
    this.dbState = this.dep.dbState;
    this.generateId();

    const database = this.dep.schema.database;
    const up = this.resolveEndpoint(this.upstream, database);
    const down = this.resolveEndpoint(this.downstream, database);
    this.upstreamTable = up.table;
    this.upstreamFields = up.fields;
    this.downstreamTable = down.table;
    this.downstreamFields = down.fields;

    this.upstreamFields.forEach((field) => field.pushDepEdge(this));
    this.downstreamFields.forEach((field) => field.pushDepEdge(this));
  }

  /**
   * Resolve an upstream or downstream endpoint against the database.
   * Throws via this.error() if the referenced table or field can't be found.
   */
  resolveEndpoint (
    endpointData: { schemaName?: string | null; tableName: string; fieldNames?: string[] },
    database: Database,
  ): { table: Table; fields: Field[] } {
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

  normalize (model: NormalizedModel) {
    if (!model.depEdges) model.depEdges = {};
    model.depEdges[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportParentIds(),
    };
  }
}

export default DepEdge;
