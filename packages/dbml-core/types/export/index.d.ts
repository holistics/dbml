import { ExportFormatOptions } from "./ModelExporter";

declare function _export(str: string, format: ExportFormatOptions): string;
declare const _default: {
    export: typeof _export;
};
export default _default;
