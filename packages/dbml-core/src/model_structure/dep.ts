import { get } from 'lodash-es';
import { DEFAULT_SCHEMA_NAME } from './config';
import DepEdge from './depEdge';
import Element from './element';
import type { RawDep, RawDepEdgeInput } from '../../types/model_structure/dep';
import type { RawDepEdge } from '../../types/model_structure/dep_edge';
import type { Token, Color } from '../../types/model_structure/element';
import type { NormalizedModel } from '../../types/model_structure/database';
import type Schema from '../../types/model_structure/schema';
import type DbState from '../../types/model_structure/dbState';

class Dep extends Element {
  name: string | null;
  color: Color | undefined;
  note: string | null;
  noteToken: Token | null;
  metadata: Record<string, string | number | boolean | null> | null;
  edges: DepEdge[];
  schema: Schema;
  dbState: DbState;
  id!: number;

  constructor ({
    name, color, note, metadata, edges, token, schema = {} as Schema,
  }: RawDep) {
    super(token);
    this.name = name ?? null;
    this.color = color;
    this.note = note ? get(note, 'value', note) as string : null;
    this.noteToken = note ? get(note, 'token', null) : null;
    this.metadata = metadata ?? null;
    this.edges = [];
    this.schema = schema;
    this.dbState = this.schema.dbState;
    this.generateId();

    this.processEdges(edges ?? []);
  }

  generateId () {
    this.id = this.dbState.generateId('depId');
  }

  processEdges (rawEdges: RawDepEdgeInput[]) {
    rawEdges.forEach((rawEdge) => {
      const upSchema = rawEdge.upstream?.schemaName || DEFAULT_SCHEMA_NAME;
      const downSchema = rawEdge.downstream?.schemaName || DEFAULT_SCHEMA_NAME;
      const upTable = rawEdge.upstream?.tableName;
      const downTable = rawEdge.downstream?.tableName;
      const upColumn = rawEdge.upstream?.fieldNames?.join(",");
      const downColumn = rawEdge.downstream?.fieldNames?.join(",");
      if (upSchema === downSchema && upTable === downTable && upColumn === downColumn) {
        this.error(`Self-loop Dep edge not allowed: "${upSchema}"."${upTable}" columns cannot depend on itself`);
      }
      this.edges.push(new DepEdge({ ...rawEdge, dep: this } as RawDepEdge));
    });
  }

  export () {
    return {
      ...this.shallowExport(),
      ...this.exportChild(),
    };
  }

  shallowExport () {
    return {
      name: this.name,
      color: this.color,
      note: this.note,
      metadata: this.metadata,
    };
  }

  exportChild () {
    return {
      edges: this.edges.map((e) => e.export()),
    };
  }

  exportChildIds () {
    return {
      edgeIds: this.edges.map((e) => e.id),
    };
  }

  exportParentIds () {
    return {
      schemaId: this.schema.id,
    };
  }

  normalize (model: NormalizedModel) {
    model.deps[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportChildIds(),
      ...this.exportParentIds(),
    };

    this.edges.forEach((edge) => edge.normalize(model));
  }
}

export default Dep;
