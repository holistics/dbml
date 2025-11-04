/**
 * Centralized Type Definitions for DBML Playground
 * 
 * This file contains all playground-specific interfaces and types.
 * By centralizing types, we eliminate duplication and provide a single
 * source of truth for the entire application.
 * 
 * Design Principles Applied:
 * - Single Source of Truth: All types defined in one place
 * - No Duplication: Eliminates redundant interface definitions
 * - Easy Maintenance: Changes only need to be made in one location
 */

// Import types we need to reference
import type { Database, ElementKind } from '@dbml/parse'

// Re-export for convenience
export type { Database, ElementKind } from '@dbml/parse'
export type { Range } from 'monaco-editor'

// ===== PIPELINE TYPES =====

export type PipelineStage = 'lexer' | 'parser' | 'analyzer' | 'interpreter'

export interface ParserStageOutput {
  readonly lexer: unknown
  readonly parser: unknown
  readonly analyzer: unknown
  readonly interpreter: unknown
}

export interface ParserError {
  readonly code: number
  readonly message: string
  readonly location: {
    readonly line: number
    readonly column: number
  }
}

export interface ParserResult {
  readonly success: boolean
  readonly outputs: ParserStageOutput
  readonly errors: readonly ParserError[]
}

// ===== USER DATA & PREFERENCES =====

export interface UserData {
  openingTab: PipelineStage
  isRawJson: boolean
  isVim: boolean
  dbml: string
}

export interface ReactiveParserOptions {
  /** Debounce delay in milliseconds */
  readonly debounceMs: number
  /** Initial DBML content */
  readonly initialContent: string
}

// ===== TOKEN & NAVIGATION TYPES =====

export interface Token {
  kind: string
  value: string
  position: {
    line: number
    column: number
  }
}

export interface TokenMetadata {
  tokenIndex: number
  kind: string
  value: string
  startPosition: { line: number; column: number }
  endPosition: { line: number; column: number }
  monacoRange: any // monaco.Range
}

export interface LexerToDbmlMap {
  [tokenIndex: number]: TokenMetadata
}

export interface DbmlToLexerMap {
  [positionKey: string]: TokenMetadata[]
}

export interface TokenNavigationEvents {
  'navigate:token-to-dbml': { tokenIndex: number; modifier: 'cmd' | 'ctrl' | 'button' }
  'navigate:dbml-to-token': { line: number; column: number; modifier: 'cmd' | 'ctrl' }
  'navigate:range-to-tokens': { startLine: number; startCol: number; endLine: number; endCol: number }
}

// ===== AST & SEMANTIC TYPES =====

export interface SemanticASTNode {
  id: string // Internal ID for Vue reactivity - NOT for debugging display
  type: ElementKind | 'database' | 'column' | 'index' | 'note' | 'unknown'
  name: string
  displayName: string
  icon: string
  children: SemanticASTNode[]
  accessPath: string

  // REUSE parser structures instead of duplicating
  data?: any

  // Source position using parser's Position interface
  sourcePosition?: {
    start: { line: number; column: number; offset: number }
    end: { line: number; column: number; offset: number }
    raw?: {
      startPos: any
      endPos: any
      start: number
      end: number
      fullStart: number
      fullEnd: number
      id: number
      kind: any
    }
    token?: any
  }
}

export interface AccessPath {
  raw: string
  description: string
  value: any
}

export interface FilterOptions {
  showInternalNodes: boolean
  showTokenInfo: boolean
  expandLevel: number
}

export interface ParserIntegrationInfo {
  version: string
  features: string[]
  elementTypes: string[]
}

export interface ElementHandler {
  canHandle(element: any): boolean
  transform(element: any, path: string): SemanticASTNode
  getElementType(): ElementKind | string
  getPriority(): number
}

// ===== INTERPRETER TREE TYPES =====

export interface InterpreterTreeNode {
  id: string
  propertyName: string
  value: string
  rawData: any
  children: InterpreterTreeNode[]
  accessPath: string
  nodeType: string
}

// ===== SAMPLE CONTENT TYPES =====

export interface SampleCategory {
  readonly name: string
  readonly description: string
  readonly content: string
}

// ===== COMPONENT PROP TYPES =====

export interface ParserOutputViewerProps {
  readonly data: unknown
  readonly title?: string
}

export interface InterpreterViewProps {
  readonly interpreterOutput: Database | unknown
}

export interface InterpreterTreeViewProps {
  readonly interpreterOutput: Database | any
}

export interface InterpreterTreeNodeProps {
  readonly node: InterpreterTreeNode
  readonly selectedNode: InterpreterTreeNode | null
  readonly expandedNodes: Set<string>
  readonly level: number
}

// ===== EVENT TYPES =====

export interface NavigationPosition {
  start: { line: number; column: number; offset: number }
  end: { line: number; column: number; offset: number }
}

export interface NodeClickEvent {
  node: InterpreterTreeNode | SemanticASTNode
}

export interface NodeExpandEvent {
  id: string
  expanded: boolean
}

export interface PositionClickEvent {
  node: InterpreterTreeNode | SemanticASTNode
  position: any
} 
