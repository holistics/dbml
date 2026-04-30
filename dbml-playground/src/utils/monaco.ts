import * as monaco from 'monaco-editor';

// @dbml/parse positions are 0-indexed, Monaco is 1-indexed.
export function toMonacoRange (
  startPos: { line: number; column: number },
  endPos?: { line: number; column: number } | null,
): monaco.IRange {
  return {
    startLineNumber: startPos.line + 1,
    startColumn: startPos.column + 1,
    endLineNumber: endPos && !Number.isNaN(endPos.line) ? endPos.line + 1 : startPos.line + 1,
    endColumn: endPos && !Number.isNaN(endPos.line) ? endPos.column + 1 : startPos.column + 1,
  };
}
