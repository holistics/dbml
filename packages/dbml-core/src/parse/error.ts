export type WarningLevel = 'error' | 'warning' | 'info';

export type ErrorCode = number;

export interface EditorPosition {
  line: number;
  column: number;
}

export interface CompilerDiagnostic {
  readonly message: string;
  readonly filepath: string;
  readonly stack?: unknown;
  readonly location: {
    start: EditorPosition;
    end?: EditorPosition;
  };
  readonly type?: WarningLevel;
  readonly code?: ErrorCode;
}

type DiagInput = CompilerDiagnostic | CompilerDiagnostics | DiagInput[];

export class CompilerDiagnostics {
  diags: CompilerDiagnostic[];

  constructor (diags: CompilerDiagnostic[]) {
    this.diags = diags;
  }

  static create (nestedDiags: DiagInput): CompilerDiagnostics {
    return new CompilerDiagnostics(flattenDiag(nestedDiags));
  }

  map (callback: (diag: CompilerDiagnostic) => CompilerDiagnostic): CompilerDiagnostics {
    return CompilerDiagnostics.create(this.diags.map(callback));
  }
}

function flattenDiag (diag: DiagInput): CompilerDiagnostic[] {
  if (Array.isArray(diag)) return diag.flatMap(flattenDiag);
  if (diag instanceof CompilerDiagnostics) return diag.diags;
  return [diag];
}

type ParseDiagnosticInput = {
  diagnostic: string;
  code?: number;
  filepath: { absolute: string };
  nodeOrToken: { startPos: EditorPosition; endPos: EditorPosition };
};

// Convert @dbml/parse CompileError/CompileWarning/CompileInfo array into legacy @dbml/core CompilerDiagnostics.
export function processDbmlParserDiagnostics (
  errors: ParseDiagnosticInput[],
  type: WarningLevel = 'error',
): CompilerDiagnostics {
  return new CompilerDiagnostics(errors.map((error) => ({
    message: error.diagnostic,
    filepath: error.filepath.absolute,
    location: {
      start: error.nodeOrToken.startPos,
      end: error.nodeOrToken.endPos,
    },
    type,
    code: error.code,
  })));
}
