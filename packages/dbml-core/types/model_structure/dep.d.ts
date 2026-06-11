import Element, { Token } from './element';
import DepEdge from './dep_edge';
import Schema from './schema';
import DbState from './dbState';
import Database, { NormalizedModel } from './database';

export interface RawDepEndpoint {
    schemaName?: string | null;
    tableName: string;
    fieldNames?: string[];
}

export interface RawDepEdgeInput {
    upstream: RawDepEndpoint;
    downstream: RawDepEndpoint;
    token?: Token;
}

export interface RawDep {
    name?: string | null;
    note?: { value?: string; token?: Token } | string | null;
    custom?: Record<string, string | number | boolean | null> | null;
    edges: RawDepEdgeInput[];
    token?: Token;
    schema: Schema;
}

declare class Dep extends Element {
    name: string | null;
    note: string | null;
    noteToken: Token;
    custom: Record<string, string | number | boolean | null> | null;
    edges: DepEdge[];
    schema: Schema;
    dbState: DbState;
    id: number;
    database: Database;
    constructor({ name, note, custom, edges, token, schema }: RawDep);
    generateId(): void;
    processEdges(rawEdges: RawDepEdgeInput[]): void;
    export(): {
        name: string | null;
        note: string | null;
        custom: Record<string, string | number | boolean | null> | null;
        edges: {
            upstream: { schemaName: string | null; tableName: string; fieldNames: string[] };
            downstream: { schemaName: string | null; tableName: string; fieldNames: string[] };
        }[];
    };
    shallowExport(): {
        name: string | null;
        note: string | null;
        custom: Record<string, string | number | boolean | null> | null;
    };
    exportChild(): {
        edges: {
            upstream: { schemaName: string | null; tableName: string; fieldNames: string[] };
            downstream: { schemaName: string | null; tableName: string; fieldNames: string[] };
        }[];
    };
    exportChildIds(): {
        edgeIds: number[];
    };
    exportParentIds(): {
        schemaId: number;
    };
    normalize(model: NormalizedModel): void;
}

export interface NormalizedDep {
    id: number;
    name: string | null;
    note: string | null;
    custom: Record<string, string | number | boolean | null> | null;
    schemaId: number;
    edgeIds: number[];
}

export interface NormalizedDepIdMap {
    [_id: number]: NormalizedDep;
}

export default Dep;
