export type RecordValueType = 'string' | 'bool' | 'integer' | 'real' | 'date' | 'time' | 'datetime' | string;

export interface RecordValue {
    value: any;
    type: RecordValueType;
}

export interface RawTableRecord {
    schemaName: string | undefined;
    tableName: string;
    columns: string[];
    values: {
        value: any;
        type: RecordValueType;
    }[][];
}

export default interface TableRecord extends RawTableRecord {
    id: number;
}

export type NormalizedRecord = TableRecord;

export interface NormalizedRecordIdMap {
    [_id: number]: NormalizedRecord;
}
