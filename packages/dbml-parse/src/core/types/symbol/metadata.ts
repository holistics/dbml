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
import type {
  Internable,
} from '../internable';
import {
  UNHANDLED,
} from '../module';
import {
  ElementKind,
} from '../keywords';
import {
  getBody,
  destructureComplexVariableTuple,
  destructureCallExpression,
} from '@/core/utils/expression';
import {
  TablePartial,
} from '../schemaJson';

export enum MetadataKind {
  Ref = 'ref',
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
    const sym = compiler.nodeReferee(n).getFiltered(UNHANDLED) as ColumnSymbol | undefined;
    return sym
      ? [
          sym,
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
