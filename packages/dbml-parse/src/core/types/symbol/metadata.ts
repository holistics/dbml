import type Compiler from '@/compiler';
import {
  AttributeNode,
  CallExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  InfixExpressionNode,
  PrefixExpressionNode,
  type SyntaxNode,
} from '../nodes';
import type {
  ColumnSymbol,
  NodeSymbol,
  ProgramSymbol,
  TablePartialSymbol,
  TableSymbol,
} from '../symbol';
import { SymbolKind } from '../symbol';
import type { Internable } from '../internable';
import { UNHANDLED } from '../module';
import { ElementKind, SettingName } from '../keywords';
import {
  getBody,
  destructureComplexVariableTuple,
  destructureCallExpression,
} from '@/core/utils/expression';

export enum MetadataKind {
  Ref = 'ref',
  Dep = 'dep',
  PartialRef = 'partial ref',
  TableChecks = 'table checks',
  Indexes = 'indexes',
  Records = 'records',
  Project = 'project',
}

declare const __nodeMetadataBrand: unique symbol;
export type NodeMetadataId = number & { readonly [__nodeMetadataBrand]: true };

declare const __internedNodeMetadataBrand: unique symbol;
export type InternedNodeMetadata = string & { readonly [__internedNodeMetadataBrand]: true };

export abstract class NodeMetadata implements Internable<InternedNodeMetadata> {
  private static id = 0;

  abstract readonly kind: MetadataKind;
  declaration: SyntaxNode;
  id: NodeMetadataId;

  constructor (declaration: SyntaxNode) {
    this.declaration = declaration;
    this.id = ++NodeMetadata.id as NodeMetadataId;
  }

  intern (): InternedNodeMetadata {
    return `metadata@${this.declaration.filepath.intern()}:${this.id}` as InternedNodeMetadata;
  }

  abstract owners (compiler: Compiler): NodeSymbol[];
}

// Standalone Ref: `Ref name: a.x > b.y [settings]`
export class RefMetadata extends NodeMetadata {
  declare declaration: ElementDeclarationNode | AttributeNode;

  readonly kind = MetadataKind.Ref;

  constructor (declaration: ElementDeclarationNode | AttributeNode) {
    super(declaration);
  }

  // This is set for inline refs
  // and nested refs
  container (compiler: Compiler): TableSymbol | undefined {
    const parent = this.declaration.parentOfKind(ElementDeclarationNode);
    if (parent?.isKind(ElementKind.Table)) {
      return compiler.nodeSymbol(parent).getFiltered(UNHANDLED) as TableSymbol | undefined;
    }
    return undefined;
  }

  leftColumns (compiler: Compiler): ColumnSymbol[] {
    if (this.declaration instanceof ElementDeclarationNode) {
      const field = getBody(this.declaration)[0];
      if (!(field instanceof FunctionApplicationNode)) return [];
      const infix = field.callee;
      if (!(infix instanceof InfixExpressionNode)) return [];
      return extractColumnsFromEndpoint(compiler, infix.leftExpression);
    }
    if (this.declaration instanceof AttributeNode) {
      const colNode = this.declaration.parentOfKind(FunctionApplicationNode);
      if (!colNode) return [];
      const sym = compiler.nodeSymbol(colNode).getFiltered(UNHANDLED) as ColumnSymbol | undefined;
      return sym
        ? [
            sym,
          ]
        : [];
    }
    return [];
  }

  rightColumns (compiler: Compiler): ColumnSymbol[] {
    if (this.declaration instanceof ElementDeclarationNode) {
      const field = getBody(this.declaration)[0];
      if (!(field instanceof FunctionApplicationNode)) return [];
      const infix = field.callee;
      if (!(infix instanceof InfixExpressionNode)) return [];
      return extractColumnsFromEndpoint(compiler, infix.rightExpression);
    }
    if (this.declaration instanceof AttributeNode) {
      const prefix = this.declaration.value;
      if (!(prefix instanceof PrefixExpressionNode)) return [];
      return extractColumnsFromEndpoint(compiler, prefix.expression);
    }
    return [];
  }

  leftTable (compiler: Compiler): TableSymbol | undefined {
    if (this.declaration instanceof ElementDeclarationNode) {
      const field = getBody(this.declaration)[0];
      if (!(field instanceof FunctionApplicationNode)) return undefined;
      const infix = field.callee;
      if (!(infix instanceof InfixExpressionNode)) return undefined;
      return extractTableFromEndpoint(compiler, infix.leftExpression);
    }
    if (this.declaration instanceof AttributeNode) {
      return this.container(compiler);
    }
    return undefined;
  }

  rightTable (compiler: Compiler): TableSymbol | undefined {
    if (this.declaration instanceof ElementDeclarationNode) {
      const field = getBody(this.declaration)[0];
      if (!(field instanceof FunctionApplicationNode)) return undefined;
      const infix = field.callee;
      if (!(infix instanceof InfixExpressionNode)) return undefined;
      return extractTableFromEndpoint(compiler, infix.rightExpression);
    }
    if (this.declaration instanceof AttributeNode) {
      const prefix = this.declaration.value;
      if (!(prefix instanceof PrefixExpressionNode)) return undefined;
      return extractTableFromEndpoint(compiler, prefix.expression) ?? this.container(compiler);
    }
    return undefined;
  }

  op (_compiler: Compiler): '>' | '<' | '-' | '<>' | undefined {
    if (this.declaration instanceof ElementDeclarationNode) {
      const field = getBody(this.declaration)[0];
      if (!(field instanceof FunctionApplicationNode)) return undefined;
      const infix = field.callee;
      if (!(infix instanceof InfixExpressionNode)) return undefined;
      return infix.op?.value as '>' | '<' | '-' | '<>' | undefined;
    }
    if (this.declaration instanceof AttributeNode) {
      const prefix = this.declaration.value;
      if (!(prefix instanceof PrefixExpressionNode)) return undefined;
      return prefix.op?.value as '>' | '<' | '-' | '<>' | undefined;
    }
    return undefined;
  }

  active (compiler: Compiler): boolean {
    if (!(this.declaration instanceof ElementDeclarationNode)) return true;
    const field = getBody(this.declaration)[0];
    if (!field) return true;
    const s = compiler.nodeSettings(field).getFiltered(UNHANDLED);
    return !s?.[SettingName.Inactive]?.length;
  }

  leftToken (): SyntaxNode {
    // Standalone ref
    if (this.declaration instanceof ElementDeclarationNode) {
      const field = getBody(this.declaration)[0];
      if (field instanceof FunctionApplicationNode) {
        const infix = field.callee;
        if (infix instanceof InfixExpressionNode && infix.leftExpression) {
          return infix.leftExpression;
        }
      }
    }
    // Inline ref
    if (this.declaration instanceof AttributeNode) {
      const columnField = this.declaration.parentOfKind(FunctionApplicationNode);
      if (columnField) return columnField;
    }
    return this.declaration;
  }

  rightToken (): SyntaxNode {
    if (this.declaration instanceof ElementDeclarationNode) {
      const field = getBody(this.declaration)[0];
      if (field instanceof FunctionApplicationNode) {
        const infix = field.callee;
        if (infix instanceof InfixExpressionNode && infix.rightExpression) {
          return infix.rightExpression;
        }
      }
    }

    // Inline ref
    if (this.declaration instanceof AttributeNode) {
      return this.declaration;
    }
    return this.declaration;
  }

  override owners (compiler: Compiler): NodeSymbol[] {
    const leftTableSymbol = this.leftTable(compiler);
    const rightTableSymbol = this.rightTable(compiler);

    if (!leftTableSymbol || !rightTableSymbol) return [];

    const declarationFilepath = this.declaration.filepath;
    const reachableFiles = compiler.reachableFiles();
    return reachableFiles
      .flatMap((f) => compiler.nodeSymbol(compiler.parseFile(f).getValue().ast).getFiltered(UNHANDLED) || [])
      .filter((s) => {
        const reachableFromProgram = compiler.reachableFiles(s.filepath);
        return reachableFromProgram.some((f) => f.equals(declarationFilepath))
          && (s as ProgramSymbol).inNestedSchema(compiler, leftTableSymbol)
          && (s as ProgramSymbol).inNestedSchema(compiler, rightTableSymbol);
      });
  }
}

export class DepMetadata extends NodeMetadata {
  declare declaration: ElementDeclarationNode | AttributeNode;

  readonly kind = MetadataKind.Dep;

  constructor (declaration: ElementDeclarationNode | AttributeNode) {
    super(declaration);
  }

  container (compiler: Compiler): TableSymbol | undefined {
    const parent = this.declaration.parentOfKind(ElementDeclarationNode);
    if (parent?.isKind(ElementKind.Table)) {
      return compiler.nodeSymbol(parent).getFiltered(UNHANDLED) as TableSymbol | undefined;
    }
    return undefined;
  }

  edgeExpressions (): InfixExpressionNode[] {
    if (!(this.declaration instanceof ElementDeclarationNode)) return [];
    return getBody(this.declaration)
      .filter((f): f is FunctionApplicationNode => f instanceof FunctionApplicationNode)
      .map((f) => f.callee)
      .filter((e): e is InfixExpressionNode => e instanceof InfixExpressionNode);
  }

  upstreamColumns (compiler: Compiler): ColumnSymbol[][] {
    if (this.declaration instanceof ElementDeclarationNode) {
      return this.edgeExpressions().map((infix) => {
        const upstream = infix.op?.value === '<-' ? infix.rightExpression : infix.leftExpression;
        return extractColumnsFromEndpoint(compiler, upstream);
      });
    }
    if (this.declaration instanceof AttributeNode) {
      const prefix = this.declaration.value;
      if (!(prefix instanceof PrefixExpressionNode)) return [];
      const op = prefix.op?.value;
      const hostCol = this.hostColumn(compiler);
      const otherCols = extractColumnsFromEndpoint(compiler, prefix.expression);
      if (op === '->') return [hostCol ? [hostCol] : []];
      if (op === '<-') return [otherCols];
    }
    return [];
  }

  downstreamColumns (compiler: Compiler): ColumnSymbol[][] {
    if (this.declaration instanceof ElementDeclarationNode) {
      return this.edgeExpressions().map((infix) => {
        const downstream = infix.op?.value === '<-' ? infix.leftExpression : infix.rightExpression;
        return extractColumnsFromEndpoint(compiler, downstream);
      });
    }
    if (this.declaration instanceof AttributeNode) {
      const prefix = this.declaration.value;
      if (!(prefix instanceof PrefixExpressionNode)) return [];
      const op = prefix.op?.value;
      const hostCol = this.hostColumn(compiler);
      const otherCols = extractColumnsFromEndpoint(compiler, prefix.expression);
      if (op === '->') return [otherCols];
      if (op === '<-') return [hostCol ? [hostCol] : []];
    }
    return [];
  }

  upstreamTables (compiler: Compiler): (TableSymbol | undefined)[] {
    if (this.declaration instanceof ElementDeclarationNode) {
      return this.edgeExpressions().map((infix) => {
        const upstream = infix.op?.value === '<-' ? infix.rightExpression : infix.leftExpression;
        return extractTableFromDepEndpoint(compiler, upstream);
      });
    }
    if (this.declaration instanceof AttributeNode) {
      const prefix = this.declaration.value;
      if (!(prefix instanceof PrefixExpressionNode)) return [];
      const op = prefix.op?.value;
      const otherTbl = extractTableFromDepEndpoint(compiler, prefix.expression);
      if (op === '->') return [this.container(compiler)];
      if (op === '<-') return [otherTbl];
    }
    return [];
  }

  downstreamTables (compiler: Compiler): (TableSymbol | undefined)[] {
    if (this.declaration instanceof ElementDeclarationNode) {
      return this.edgeExpressions().map((infix) => {
        const downstream = infix.op?.value === '<-' ? infix.leftExpression : infix.rightExpression;
        return extractTableFromDepEndpoint(compiler, downstream);
      });
    }
    if (this.declaration instanceof AttributeNode) {
      const prefix = this.declaration.value;
      if (!(prefix instanceof PrefixExpressionNode)) return [];
      const op = prefix.op?.value;
      const otherTbl = extractTableFromDepEndpoint(compiler, prefix.expression);
      if (op === '->') return [otherTbl];
      if (op === '<-') return [this.container(compiler)];
    }
    return [];
  }

  private hostColumn (compiler: Compiler): ColumnSymbol | undefined {
    if (!(this.declaration instanceof AttributeNode)) return undefined;
    const colNode = this.declaration.parentOfKind(FunctionApplicationNode);
    if (!colNode) return undefined;
    return compiler.nodeSymbol(colNode).getFiltered(UNHANDLED) as ColumnSymbol | undefined;
  }

  override owners (compiler: Compiler): NodeSymbol[] {
    const upstreamTbls = this.upstreamTables(compiler);
    const downstreamTbls = this.downstreamTables(compiler);

    const tableSymbols = [...upstreamTbls, ...downstreamTbls].filter((t): t is TableSymbol => !!t);
    if (tableSymbols.length === 0) return [];

    const declarationFilepath = this.declaration.filepath;
    const reachableFiles = compiler.reachableFiles();
    return reachableFiles
      .flatMap((f) => compiler.nodeSymbol(compiler.parseFile(f).getValue().ast).getFiltered(UNHANDLED) || [])
      .filter((s) => {
        const reachableFromProgram = compiler.reachableFiles(s.filepath);
        return reachableFromProgram.some((f) => f.equals(declarationFilepath))
          && tableSymbols.every((t) => (s as ProgramSymbol).inNestedSchema(compiler, t));
      });
  }
}

export class PartialRefMetadata extends NodeMetadata {
  readonly kind = MetadataKind.PartialRef;

  constructor (declaration: SyntaxNode) {
    super(declaration);
  }

  container (compiler: Compiler): TablePartialSymbol | undefined {
    const parent = this.declaration.parentOfKind(ElementDeclarationNode);
    if (parent?.isKind(ElementKind.TablePartial)) {
      return compiler.nodeSymbol(parent).getFiltered(UNHANDLED) as TablePartialSymbol | undefined;
    }
    return undefined;
  }

  leftColumns (compiler: Compiler): ColumnSymbol[] {
    if (!(this.declaration instanceof AttributeNode)) return [];
    const colNode = this.declaration.parentOfKind(FunctionApplicationNode);
    if (!colNode) return [];
    const symbol = compiler.nodeSymbol(colNode).getFiltered(UNHANDLED) as ColumnSymbol | undefined;
    return symbol
      ? [
          symbol,
        ]
      : [];
  }

  rightColumns (compiler: Compiler): ColumnSymbol[] {
    if (!(this.declaration instanceof AttributeNode)) return [];
    const prefix = this.declaration.value;
    if (!(prefix instanceof PrefixExpressionNode)) return [];
    return extractColumnsFromEndpoint(compiler, prefix.expression);
  }

  leftTablePartial (compiler: Compiler): TablePartialSymbol | undefined {
    if (!(this.declaration instanceof AttributeNode)) return undefined;
    return this.container(compiler);
  }

  rightTable (compiler: Compiler): TableSymbol | TablePartialSymbol | undefined {
    if (!(this.declaration instanceof AttributeNode)) return undefined;
    const prefix = this.declaration.value;
    if (!(prefix instanceof PrefixExpressionNode)) return undefined;
    return extractTableFromEndpoint(compiler, prefix.expression) ?? this.container(compiler);
  }

  op (_compiler: Compiler): '>' | '<' | '-' | '<>' | undefined {
    if (!(this.declaration instanceof AttributeNode)) return undefined;
    const prefix = this.declaration.value;
    if (!(prefix instanceof PrefixExpressionNode)) return undefined;
    return prefix.op?.value as '>' | '<' | '-' | '<>' | undefined;
  }

  leftToken (): SyntaxNode {
    if (this.declaration instanceof AttributeNode) {
      const columnField = this.declaration.parentOfKind(FunctionApplicationNode);
      if (columnField) return columnField;
    }
    return this.declaration;
  }

  rightToken (): SyntaxNode {
    if (this.declaration instanceof AttributeNode) {
      return this.declaration;
    }
    return this.declaration;
  }

  override owners (compiler: Compiler): NodeSymbol[] {
    const leftTableSymbol = this.leftTablePartial(compiler);
    const rightTableSymbol = this.rightTable(compiler);

    if (!leftTableSymbol || !rightTableSymbol) return [];

    const reachableFiles = compiler.reachableFiles();
    return reachableFiles
      .flatMap((f) => compiler.nodeSymbol(compiler.parseFile(f).getValue().ast).getFiltered(UNHANDLED) || [])
      .filter((s) => (s as ProgramSymbol).inNestedSchema(compiler, leftTableSymbol) && (s as ProgramSymbol).inNestedSchema(compiler, rightTableSymbol));
  }
}

// Standalone check block inside table
export class TableChecksMetadata extends NodeMetadata {
  readonly kind = MetadataKind.TableChecks;

  private ownerTable: ElementDeclarationNode | undefined;

  constructor (declaration: ElementDeclarationNode) {
    super(declaration);
    this.ownerTable = declaration.parentNode?.parentOfKind(ElementDeclarationNode);
  }

  override owners (compiler: Compiler): NodeSymbol[] {
    if (!this.ownerTable) return [];
    const ownerSymbol = compiler.nodeSymbol(this.ownerTable).getFiltered(UNHANDLED);
    if (!ownerSymbol) return [];
    return [
      ownerSymbol.originalSymbol,
    ];
  }
}

// Indexes block inside table
export class IndexesMetadata extends NodeMetadata {
  readonly kind = MetadataKind.Indexes;

  private ownerTable: ElementDeclarationNode | undefined;

  constructor (declaration: SyntaxNode) {
    super(declaration);
    this.ownerTable = declaration.parentNode?.parentOfKind(ElementDeclarationNode);
  }

  override owners (compiler: Compiler): NodeSymbol[] {
    if (!this.ownerTable) return [];
    const ownerSymbol = compiler.nodeSymbol(this.ownerTable).getFiltered(UNHANDLED);
    if (!ownerSymbol) return [];
    return [
      ownerSymbol.originalSymbol,
    ];
  }
}

// Records block
export class RecordsMetadata extends NodeMetadata {
  readonly kind = MetadataKind.Records;

  constructor (declaration: SyntaxNode) {
    super(declaration);
  }

  table (compiler: Compiler): TableSymbol | undefined {
    const decl = this.declaration as ElementDeclarationNode;
    const parent = decl.parent;

    // Case 1: nested inside a table element
    if (parent instanceof ElementDeclarationNode && parent.isKind(ElementKind.Table)) {
      return compiler.nodeSymbol(parent).getFiltered(UNHANDLED) as TableSymbol | undefined;
    }

    // Case 2: standalone records - table_name(col1, col2) { ... }
    const nameNode = decl.name;
    if (!(nameNode instanceof CallExpressionNode)) return undefined;
    const fragments = destructureCallExpression(nameNode);
    if (!fragments) return undefined;
    const tableNode = fragments.variables.at(-1);
    if (!tableNode) return undefined;
    const sym = compiler.nodeReferee(tableNode).getFiltered(UNHANDLED);
    return sym?.originalSymbol as TableSymbol | undefined;
  }

  override owners (compiler: Compiler): NodeSymbol[] {
    const tableSymbol = this.table(compiler);
    if (!tableSymbol) return [];

    const reachableFiles = compiler.reachableFiles();
    return reachableFiles
      .flatMap((f) => compiler.nodeSymbol(compiler.parseFile(f).getValue().ast).getFiltered(UNHANDLED) || [])
      .filter((s) => (s as ProgramSymbol).inNestedSchema(compiler, tableSymbol));
  }
}

/* Utils */

// Project element
export class ProjectMetadata extends NodeMetadata {
  readonly kind = MetadataKind.Project;

  constructor (declaration: SyntaxNode) {
    super(declaration);
  }

  override owners (compiler: Compiler): NodeSymbol[] {
    const filepath = this.declaration.filepath;
    const programNode = compiler.parseFile(filepath).getValue().ast;
    const symbol = compiler.nodeSymbol(programNode).getFiltered(UNHANDLED);
    return symbol
      ? [
          symbol,
        ]
      : [];
  }
}

function extractColumnsFromEndpoint (compiler: Compiler, expr: SyntaxNode | undefined): ColumnSymbol[] {
  if (!expr) return [];
  const fragments = destructureComplexVariableTuple(expr);
  if (!fragments) return [];
  const colNodes = fragments.tupleElements.length > 0
    ? fragments.tupleElements
    : fragments.variables.at(-1)
      ? [
          fragments.variables.at(-1)!,
        ]
      : [];
  return colNodes.flatMap((n) => {
    const sym = compiler.nodeReferee(n).getFiltered(UNHANDLED);
    return sym?.isKind(SymbolKind.Column)
      ? [
          sym as ColumnSymbol,
        ]
      : [];
  });
}

function extractTableFromEndpoint (compiler: Compiler, expr: SyntaxNode | undefined): TableSymbol | undefined {
  if (!expr) return undefined;
  const fragments = destructureComplexVariableTuple(expr);
  if (!fragments) return undefined;
  // If tuple: table = last variable; else table = second-to-last (last is column)
  const tableNode = fragments.tupleElements.length > 0
    ? fragments.variables.at(-1)
    : fragments.variables.at(-2);
  if (!tableNode) return undefined;
  return compiler.nodeReferee(tableNode).getFiltered(UNHANDLED) as TableSymbol | undefined;
}

function extractTableFromDepEndpoint (compiler: Compiler, expr: SyntaxNode | undefined): TableSymbol | undefined {
  if (!expr) return undefined;
  const fragments = destructureComplexVariableTuple(expr);
  if (!fragments) return undefined;

  if (fragments.tupleElements.length > 0) {
    const tableNode = fragments.variables.at(-1);
    if (!tableNode) return undefined;
    return compiler.nodeReferee(tableNode).getFiltered(UNHANDLED) as TableSymbol | undefined;
  }

  const last = fragments.variables.at(-1);
  if (last) {
    const lastSym = compiler.nodeReferee(last).getFiltered(UNHANDLED);
    if (lastSym?.isKind(SymbolKind.Table)) return lastSym as TableSymbol;
  }
  const secondLast = fragments.variables.at(-2);
  if (secondLast) {
    return compiler.nodeReferee(secondLast).getFiltered(UNHANDLED) as TableSymbol | undefined;
  }
  return undefined;
}
