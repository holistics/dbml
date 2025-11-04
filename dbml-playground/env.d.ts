/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'monaco-editor' {
  export * from 'monaco-editor/esm/vs/editor/editor.api'
}

declare module 'vue-json-viewer' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<any, any, any>
  export default component
}

declare module '@dbml/parse' {
  export class Compiler {
    setSource(source: string): void
    parse: {
      ast(): any
      tokens(): any[]
      errors(): any[]
    }
  }
  
  // Parser types that we reuse in playground
  export enum ElementKind {
    Table = 'table',
    Enum = 'enum',
    Ref = 'ref',
    Note = 'note',
    Project = 'project',
    Indexes = 'indexes',
    TableGroup = 'tablegroup',
    TablePartial = 'tablepartial',
  }
  
  export enum SyntaxNodeKind {
    PROGRAM = '<program>',
    ELEMENT_DECLARATION = '<element-declaration>',
    FUNCTION_APPLICATION = '<function-application>',
    BLOCK_EXPRESSION = '<block-expression>',
    VARIABLE = '<variable>',
    INFIX_EXPRESSION = '<infix-expression>',
  }
  
  export interface Position {
    offset: number
    line: number
    column: number
  }
  
  export class SyntaxNode {
    id: number
    kind: SyntaxNodeKind
    startPos: Position
    endPos: Position
    start: number
    end: number
    fullStart: number
    fullEnd: number
  }
  
  export class ElementDeclarationNode extends SyntaxNode {
    type?: any
    name?: any
    body?: any
  }
  
  export class ProgramNode extends SyntaxNode {
    body: ElementDeclarationNode[]
  }
  
  // Interpreter types for structured data reuse
  export interface Database {
    schemas: []
    tables: Table[]
    notes: any[]
    refs: Ref[]
    enums: Enum[]
    tableGroups: TableGroup[]
    aliases: any[]
    project: Project
    tablePartials: TablePartial[]
  }
  
  export interface Table {
    name: string
    token: any
    note?: any
    headerColor?: string
    columns: Column[]
    indexes?: any[]
  }
  
  export interface Column {
    name: string
    type: any
    token: any
    pk?: boolean
    unique?: boolean
    not_null?: boolean
    note?: any
    dbdefault?: any
    increment?: boolean
  }
  
  export interface Enum {
    name: string
    token: any
    values: any[]
    note?: any
  }
  
  export interface Ref {
    name?: string
    endpoints: any[]
    token: any
    note?: any
    color?: string
  }
  
  export interface Project {
    name?: string | null
    token?: any
    note?: any
    [key: string]: any
  }
  
  export interface TableGroup {
    name: string
    token: any
    tables: any[]
  }
  
  export interface TablePartial {
    name: string
    token: any
    columns?: Column[]
    indexes?: any[]
  }
} 
