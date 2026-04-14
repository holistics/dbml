import type {
  Database, ElementKind,
} from '@dbml/parse';

export type {
  Database, ElementKind,
} from '@dbml/parse';
export type {
  Range,
} from 'monaco-editor';

export type PipelineStage = 'lexer' | 'parser' | 'analyzer' | 'interpreter';

export interface ParserStageOutput {
  readonly lexer: unknown;
  readonly parser: unknown;
  readonly analyzer: unknown;
  readonly interpreter: unknown;
}

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

export interface ParserResult {
  readonly success: boolean;
  readonly outputs: ParserStageOutput;
  readonly errors: readonly ParserError[];
}

export interface UserData {
  openingTab: PipelineStage;
  isRawJson: boolean;
  isVim: boolean;
  dbml: string;
}

export interface SemanticASTNode {
  id: string; // Internal ID for Vue reactivity - NOT for debugging display
  type: ElementKind | 'database' | 'column' | 'index' | 'note' | 'unknown';
  name: string;
  displayName: string;
  icon: string;
  children: SemanticASTNode[];
  accessPath: string;

  // REUSE parser structures instead of duplicating
  data?: any;

  // Source position using parser's Position interface
  sourcePosition?: {
    start: {
      line: number;
      column: number;
      offset: number;
    };
    end: {
      line: number;
      column: number;
      offset: number;
    };
    raw?: {
      startPos: any;
      endPos: any;
      start: number;
      end: number;
      fullStart: number;
      fullEnd: number;
      id: number;
      kind: any;
    };
    token?: any;
  };
}

export interface AccessPath {
  raw: string;
  description: string;
  value: any;
}

export interface FilterOptions {
  showInternalNodes: boolean;
  showTokenInfo: boolean;
  expandLevel: number;
}

export interface ParserIntegrationInfo {
  version: string;
  features: string[];
  elementTypes: string[];
}

export interface ElementHandler {
  canHandle(element: any): boolean;
  transform(element: any, path: string): SemanticASTNode;
  getElementType(): ElementKind | string;
  getPriority(): number;
}

export interface InterpreterTreeNode {
  id: string;
  propertyName: string;
  value: string;
  rawData: any;
  children: InterpreterTreeNode[];
  accessPath: string;
  nodeType: string;
}

export interface NavigationPosition {
  start: {
    line: number;
    column: number;
    offset: number;
  };
  end: {
    line: number;
    column: number;
    offset: number;
  };
}

export interface NodeClickEvent {
  node: InterpreterTreeNode | SemanticASTNode;
}

export interface NodeExpandEvent {
  id: string;
  expanded: boolean;
}

export interface PositionClickEvent {
  node: InterpreterTreeNode | SemanticASTNode;
  position: any;
}
