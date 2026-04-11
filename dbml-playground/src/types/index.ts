export type { Database, ElementKind } from '@dbml/parse';
export type { Range } from 'monaco-editor';

export interface ParserError {
  readonly code: number;
  readonly message: string;
  readonly location: {
    readonly line: number;
    readonly column: number;
  };
  readonly endLocation: {
    readonly line: number;
    readonly column: number;
  };
}

export interface NavigationPosition {
  start: { line: number; column: number; offset: number };
  end: { line: number; column: number; offset: number };
}
