import Element, { Token } from './element';
import Field from './field';
import Table from './table';
import Dep from './dep';
import DbState from './dbState';
import { NormalizedModel } from './database';

export interface DepEndpointData {
    schemaName: string | null;
    tableName: string;
    fieldNames: string[];
}

export interface RawDepEdge {
    upstream: DepEndpointData;
    downstream: DepEndpointData;
    token?: Token;
    dep: Dep;
}

declare class DepEdge extends Element {
    upstream: DepEndpointData;
    downstream: DepEndpointData;
    dep: Dep;
    dbState: DbState;
    id: number;
    upstreamTable: Table | null;
    upstreamFields: Field[];
    downstreamTable: Table | null;
    downstreamFields: Field[];
    constructor(args: RawDepEdge);
    generateId(): void;
    equals(depEdge: DepEdge): boolean;
    static compareEnd(table: Table | null, fields: Field[], otherTable: Table | null, otherFields: Field[]): boolean;
    resolveEndpoint(endpointData: { schemaName?: string | null; tableName: string; fieldNames?: string[] }, database: import('./database').default): { table: Table; fields: Field[] };
    export(): {
        upstream: DepEndpointData;
        downstream: DepEndpointData;
    };
    shallowExport(): {
        upstream: DepEndpointData;
        downstream: DepEndpointData;
    };
    exportParentIds(): {
        depId: number;
        upstreamTableId: number | null;
        upstreamFieldIds: number[];
        downstreamTableId: number | null;
        downstreamFieldIds: number[];
    };
    normalize(model: NormalizedModel): void;
}

export interface NormalizedDepEdge {
    id: number;
    upstream: DepEndpointData;
    downstream: DepEndpointData;
    depId: number;
    upstreamTableId: number | null;
    upstreamFieldIds: number[];
    downstreamTableId: number | null;
    downstreamFieldIds: number[];
}

export interface NormalizedDepEdgeIdMap {
    [_id: number]: NormalizedDepEdge;
}

export default DepEdge;
