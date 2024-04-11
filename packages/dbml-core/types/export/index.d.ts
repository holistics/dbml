import { ExportFormatOption } from './ModelExporter';

declare function _export(str: string, format: ExportFormatOption): string;
declare const _default: {
    export: typeof _export;
};
export default _default;
