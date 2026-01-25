import { ExportFormatOption } from './ModelExporter';
import { RecordValueType } from '../model_structure/database';

export interface RecordValue {
    value: any;
    type: RecordValueType;
}

declare function _export(str: string, format: ExportFormatOption): string;
declare const _default: {
    export: typeof _export;
};
export default _default;
