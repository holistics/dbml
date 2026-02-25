import type { NormalizedModel } from '../model_structure/database';
import type { NormalizedTable } from '../model_structure/table';
import type { NormalizedTableGroup } from '../model_structure/tableGroup';

export interface DbmlExporterFlags {
    /** When false, TableData (Records) blocks are omitted from the output. Defaults to true. */
    includeRecords: boolean;
}

declare class DbmlExporter {
    static hasWhiteSpace(str: string): boolean;
    static hasSquareBracket(str: string): boolean;
    static isExpression(str: string): boolean;
    static escapeNote(str: string | null): string;
    static exportEnums(enumIds: number[], model: NormalizedModel): string;
    static getFieldLines(tableId: number, model: NormalizedModel): string[];
    static getIndexLines(tableId: number, model: NormalizedModel): string[];
    static getCheckLines(tableId: number, model: NormalizedModel): string[];
    static getTableSettings(table: NormalizedTable): string;
    static exportTables(tableIds: number[], model: NormalizedModel): string;
    static buildFieldName(fieldIds: number[], model: NormalizedModel): string;
    static exportRefs(refIds: number[], model: NormalizedModel): string;
    static getTableGroupSettings(tableGroup: NormalizedTableGroup): string;
    static exportTableGroups(tableGroupIds: number[], model: NormalizedModel): string;
    static exportStickyNotes(model: NormalizedModel): string;
    static exportRecords(model: NormalizedModel): string;
    static export(model: NormalizedModel, flags: DbmlExporterFlags): string;
}

export default DbmlExporter;
