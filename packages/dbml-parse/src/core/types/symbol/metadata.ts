import type Compiler from '@/compiler';
import {
  AttributeNode,
  CallExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  InfixExpressionNode,
  PrefixExpressionNode,
  ProgramNode,
  type SyntaxNode,
} from '../nodes';
import { DEP_DOWNSTREAM, DEP_UPSTREAM } from '../schemaJson';
import type { SyntaxToken } from '../tokens';
import type {
  ColumnSymbol,
  InternedNodeSymbol,
  NodeSymbol,
  ProgramSymbol,
  TablePartialSymbol,
  TableSymbol,
} from '../symbol';
import { MetadataKind, MetadataTargetKind, SymbolKind } from './kind';
import type { Internable } from '../internable';
import type { RelationshipOp, RelationCardinality } from '../relation';
import { getMultiplicities, parseCardinality } from '../relation';
import { UNHANDLED } from '../module';
import { ElementKind, SettingName } from '../keywords';
import {
  getBody,
  destructureComplexVariable,
  destructureComplexVariableTuple,
  destructureCallExpression,
} from '@/core/utils/expression';
import { getProgramSymbol } from '@/core/global_modules/utils';
import { namedRefsIn } from '@/core/global_modules/ref/utils';

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

  /**
    * Whether this declaration applies in `program`: the program reaches the declaration's file, and the elements
    * the declaration is bound to by syntax are in the program's nested schema.
    * Cycle rule: never reads the resolution index (resolutionIndex, symbolMetadata, symbolReferences, symbolParents),
    * because the index is built from declaredTargets().
    */
  isVisibleFrom (compiler: Compiler, program: ProgramSymbol): boolean {
    if (!compiler.reachableFiles(program.filepath).some((f) => f.equals(this.declaration.filepath))) return false;

    const targets = this.targets(compiler);
    if (targets.length === 0) return false;

    return targets.every((t) => t instanceof NodeMetadata ? t.isVisibleFrom(compiler, program) : program.inNestedSchema(compiler, t));
  };

  /**
    * The candidate targets of this declaration (what it is bound to by syntax), always `originalSymbol` for symbols.
    * Used to build the resolution index.
    * WARN: Cycle rule: NEVER reads the resolution index (resolutionIndex, symbolMetadata, symbolReferences, symbolParents).
    */
  abstract targets (compiler: Compiler): (NodeSymbol | NodeMetadata)[];
}

// Standalone Ref: `Ref name: a.x > b.y [settings]`
export class RefMetadata extends NodeMetadata {
  declare declaration: ElementDeclarationNode | AttributeNode;

  readonly kind = MetadataKind.Ref;

  constructor (declaration: ElementDeclarationNode | AttributeNode) {
    super(declaration);
  }

  /** The name of a named standalone top-level Ref (`Ref name: ...`), undefined for unnamed and inline refs */
  name (compiler: Compiler): string | undefined {
    if (!(this.declaration instanceof ElementDeclarationNode)) return undefined;
    if (!(this.declaration.parentNode instanceof ProgramNode)) return undefined;
    return compiler.nodeFullname(this.declaration).getFiltered(UNHANDLED)?.at(-1);
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

  op (_compiler: Compiler): RelationshipOp | undefined {
    return this.opToken()?.value as RelationshipOp | undefined;
  }

  opToken (): SyntaxToken | undefined {
    if (this.declaration instanceof ElementDeclarationNode) {
      const field = getBody(this.declaration)[0];
      if (!(field instanceof FunctionApplicationNode)) return undefined;
      const infix = field.callee;
      if (!(infix instanceof InfixExpressionNode)) return undefined;
      return infix.op;
    }
    if (this.declaration instanceof AttributeNode) {
      const prefix = this.declaration.value;
      if (!(prefix instanceof PrefixExpressionNode)) return undefined;
      return prefix.op;
    }
    return undefined;
  }

  cardinalities (compiler: Compiler): [RelationCardinality, RelationCardinality] | undefined {
    const op = this.op(compiler);
    return op ? getMultiplicities(op) : undefined;
  }

  leftCardinality (compiler: Compiler): { min: number; max: number | '*' } | undefined {
    const c = this.cardinalities(compiler);
    return c ? parseCardinality(c[0]) : undefined;
  }

  rightCardinality (compiler: Compiler): { min: number; max: number | '*' } | undefined {
    const c = this.cardinalities(compiler);
    return c ? parseCardinality(c[1]) : undefined;
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

  /** The endpoint tables: the left-endpoint table (inline: the container), then the right one */
  override targets (compiler: Compiler): TableSymbol[] {
    const leftTableSymbol = this.leftTable(compiler);
    const rightTableSymbol = this.rightTable(compiler);
    if (!leftTableSymbol || !rightTableSymbol) return [];
    return filterDuplicateSymbols([leftTableSymbol, rightTableSymbol]);
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
        const upstream = infix.op?.value === DEP_UPSTREAM ? infix.rightExpression : infix.leftExpression;
        return extractColumnsFromEndpoint(compiler, upstream);
      });
    }
    if (this.declaration instanceof AttributeNode) {
      const prefix = this.declaration.value;
      if (!(prefix instanceof PrefixExpressionNode)) return [];
      const op = prefix.op?.value;
      const hostCol = this.hostColumn(compiler);
      const otherCols = extractColumnsFromEndpoint(compiler, prefix.expression);
      if (op === DEP_DOWNSTREAM) return [
        hostCol
          ? [
              hostCol,
            ]
          : [],
      ];
      if (op === DEP_UPSTREAM) return [
        otherCols,
      ];
    }
    return [];
  }

  downstreamColumns (compiler: Compiler): ColumnSymbol[][] {
    if (this.declaration instanceof ElementDeclarationNode) {
      return this.edgeExpressions().map((infix) => {
        const downstream = infix.op?.value === DEP_UPSTREAM ? infix.leftExpression : infix.rightExpression;
        return extractColumnsFromEndpoint(compiler, downstream);
      });
    }
    if (this.declaration instanceof AttributeNode) {
      const prefix = this.declaration.value;
      if (!(prefix instanceof PrefixExpressionNode)) return [];
      const op = prefix.op?.value;
      const hostCol = this.hostColumn(compiler);
      const otherCols = extractColumnsFromEndpoint(compiler, prefix.expression);
      if (op === DEP_DOWNSTREAM) return [
        otherCols,
      ];
      if (op === DEP_UPSTREAM) return [
        hostCol
          ? [
              hostCol,
            ]
          : [],
      ];
    }
    return [];
  }

  upstreamTables (compiler: Compiler): (TableSymbol | undefined)[] {
    if (this.declaration instanceof ElementDeclarationNode) {
      return this.edgeExpressions().map((infix) => {
        const upstream = infix.op?.value === DEP_UPSTREAM ? infix.rightExpression : infix.leftExpression;
        return extractTableFromDepEndpoint(compiler, upstream);
      });
    }
    if (this.declaration instanceof AttributeNode) {
      const prefix = this.declaration.value;
      if (!(prefix instanceof PrefixExpressionNode)) return [];
      const op = prefix.op?.value;
      const otherTbl = extractTableFromDepEndpoint(compiler, prefix.expression);
      if (op === DEP_DOWNSTREAM) return [
        this.container(compiler),
      ];
      if (op === DEP_UPSTREAM) return [
        otherTbl,
      ];
    }
    return [];
  }

  downstreamTables (compiler: Compiler): (TableSymbol | undefined)[] {
    if (this.declaration instanceof ElementDeclarationNode) {
      return this.edgeExpressions().map((infix) => {
        const downstream = infix.op?.value === DEP_UPSTREAM ? infix.leftExpression : infix.rightExpression;
        return extractTableFromDepEndpoint(compiler, downstream);
      });
    }
    if (this.declaration instanceof AttributeNode) {
      const prefix = this.declaration.value;
      if (!(prefix instanceof PrefixExpressionNode)) return [];
      const op = prefix.op?.value;
      const otherTbl = extractTableFromDepEndpoint(compiler, prefix.expression);
      if (op === DEP_DOWNSTREAM) return [
        otherTbl,
      ];
      if (op === DEP_UPSTREAM) return [
        this.container(compiler),
      ];
    }
    return [];
  }

  private hostColumn (compiler: Compiler): ColumnSymbol | undefined {
    if (!(this.declaration instanceof AttributeNode)) return undefined;
    const colNode = this.declaration.parentOfKind(FunctionApplicationNode);
    if (!colNode) return undefined;
    return compiler.nodeSymbol(colNode).getFiltered(UNHANDLED) as ColumnSymbol | undefined;
  }

  /** The endpoint tables of the Dep */
  override targets (compiler: Compiler): TableSymbol[] {
    const first = this.declaration instanceof AttributeNode
      ? this.container(compiler)
      : this.downstreamTables(compiler)[0];
    return filterDuplicateSymbols([
      first,
      ...this.upstreamTables(compiler),
      ...this.downstreamTables(compiler),
    ]);
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

  op (_compiler: Compiler): RelationshipOp | undefined {
    return this.opToken()?.value as RelationshipOp | undefined;
  }

  opToken (): SyntaxToken | undefined {
    if (!(this.declaration instanceof AttributeNode)) return undefined;
    const prefix = this.declaration.value;
    if (!(prefix instanceof PrefixExpressionNode)) return undefined;
    return prefix.op;
  }

  cardinalities (compiler: Compiler): [RelationCardinality, RelationCardinality] | undefined {
    const op = this.op(compiler);
    return op ? getMultiplicities(op) : undefined;
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

  // The TablePartial the Ref is declared on
  override targets (compiler: Compiler): TablePartialSymbol[] {
    const leftTablePartial = this.leftTablePartial(compiler);
    const rightTable = this.rightTable(compiler);
    if (!leftTablePartial || !rightTable) return [];
    return [leftTablePartial, rightTable];
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

  override targets (compiler: Compiler): NodeSymbol[] {
    if (!this.ownerTable) return [];
    const ownerSymbol = compiler.nodeSymbol(this.ownerTable).getFiltered(UNHANDLED);
    return [ownerSymbol].filter((s) => !!s);
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

  override targets (compiler: Compiler): NodeSymbol[] {
    if (!this.ownerTable) return [];
    const ownerSymbol = compiler.nodeSymbol(this.ownerTable).getFiltered(UNHANDLED);
    return [ownerSymbol].filter((s) => !!s);
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

  example (compiler: Compiler): boolean {
    const s = compiler.nodeSettings(this.declaration as ElementDeclarationNode).getFiltered(UNHANDLED);
    return !!s?.[SettingName.Example]?.length;
  }

  override targets (compiler: Compiler): TableSymbol[] {
    return [this.table(compiler)].filter((t) => !!t);
  }
}

// Metadata element block: `Metadata <target-kind> <qualified-name> { ... }`
export class MetadataElementMetadata extends NodeMetadata {
  declare declaration: ElementDeclarationNode;

  readonly kind = MetadataKind.MetadataElement;

  constructor (declaration: ElementDeclarationNode) {
    super(declaration);
  }

  /** Reaches the declaration's file only; the target's applicability is checked when attaching */
  override isVisibleFrom (compiler: Compiler, program: ProgramSymbol): boolean {
    return compiler.reachableFiles(program.filepath).some((f) => f.equals(this.declaration.filepath));
  }

  /**
    * The symbols/Refs named by the header. 0 = not found, 2+ = ambiguous (the block is then registered nowhere).
    */
  override targets (compiler: Compiler): (NodeSymbol | NodeMetadata)[] {
    const programSymbol = getProgramSymbol(compiler, this.declaration.filepath);
    if (!programSymbol) return [];

    const targetKind = getMetadataTargetKind(this.declaration);
    const nameParts = destructureComplexVariable(this.declaration.name);
    if (!nameParts?.length || !targetKind) return [];

    if (targetKind === MetadataTargetKind.Ref) {
      return namedRefsIn(compiler, programSymbol).filter((r) => r.name(compiler) === nameParts[0]);
    }

    let symbol: NodeSymbol | undefined = programSymbol;
    for (const { name, symbolKind } of mapNamePartToSymbolKind(nameParts, targetKind)) {
      if (!symbol) break;
      symbol = compiler.lookupMembers(symbol, symbolKind, name);
    }

    return symbol && symbol !== programSymbol ? [symbol.originalSymbol] : [];
  }
}

/* Utils */

// Project element
export class ProjectMetadata extends NodeMetadata {
  readonly kind = MetadataKind.Project;

  constructor (declaration: SyntaxNode) {
    super(declaration);
  }

  // A Project applies only in its own file's program
  override isVisibleFrom (_compiler: Compiler, program: ProgramSymbol): boolean {
    return program.filepath.equals(this.declaration.filepath);
  }

  override targets (compiler: Compiler): ProgramSymbol[] {
    const programSymbol = getProgramSymbol(compiler, this.declaration.filepath);
    return programSymbol ? [programSymbol] : [];
  }
}

function filterDuplicateSymbols<S extends NodeSymbol> (symbols: (S | undefined)[]): S[] {
  const seen = new Set<InternedNodeSymbol>();
  const result: S[] = [];
  for (const symbol of symbols) {
    if (!symbol) continue;

    const key = symbol.intern();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(symbol);
  }
  return result;
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
  // If tuple: table = last variable, else table = second-to-last (last is column)
  const tableNode = fragments.tupleElements.length > 0
    ? fragments.variables.at(-1)
    : fragments.variables.at(-2);
  if (!tableNode) return undefined;
  return compiler.nodeReferee(tableNode).getFiltered(UNHANDLED)?.originalSymbol as TableSymbol | undefined;
}

function extractTableFromDepEndpoint (compiler: Compiler, expr: SyntaxNode | undefined): TableSymbol | undefined {
  if (!expr) return undefined;
  const fragments = destructureComplexVariableTuple(expr);
  if (!fragments) return undefined;

  if (fragments.tupleElements.length > 0) {
    const tableNode = fragments.variables.at(-1);
    if (!tableNode) return undefined;
    return compiler.nodeReferee(tableNode).getFiltered(UNHANDLED)?.originalSymbol as TableSymbol | undefined;
  }

  const last = fragments.variables.at(-1);
  if (last) {
    const lastSym = compiler.nodeReferee(last).getFiltered(UNHANDLED)?.originalSymbol;
    if (lastSym?.isKind(SymbolKind.Table)) return lastSym as TableSymbol;
  }
  const secondLast = fragments.variables.at(-2);
  if (secondLast) {
    return compiler.nodeReferee(secondLast).getFiltered(UNHANDLED)?.originalSymbol as TableSymbol | undefined;
  }
  return undefined;
}

export function getMetadataTargetKind (node: ElementDeclarationNode): MetadataTargetKind | undefined {
  const value = node.targetKind?.value?.toLowerCase();
  return Object.values(MetadataTargetKind).find((k) => k.toLowerCase() === value);
}

export type NameWithSymbolKind = {
  name: string;
  symbolKind: SymbolKind;
};

/** @internal Exported for testing only. */
export function mapNamePartToSymbolKind (nameParts: string[], targetKind: Exclude<MetadataTargetKind, MetadataTargetKind.Ref>): NameWithSymbolKind[] {
  if (nameParts.length === 0) return [];

  let kindParts: SymbolKind[];

  switch (targetKind) {
    case MetadataTargetKind.Table:
      kindParts = [...Array(nameParts.length - 1).fill(SymbolKind.Schema), SymbolKind.Table];
      break;
    case MetadataTargetKind.Column:
      if (nameParts.length === 1) kindParts = [SymbolKind.Column];
      else kindParts = [...Array(nameParts.length - 2).fill(SymbolKind.Schema), SymbolKind.Table, SymbolKind.Column];
      break;
    case MetadataTargetKind.TableGroup:
      kindParts = [...Array(nameParts.length - 1).fill(SymbolKind.Schema), SymbolKind.TableGroup];
      break;
    case MetadataTargetKind.Note:
      kindParts = [...Array(nameParts.length - 1).fill(SymbolKind.Schema), SymbolKind.StickyNote];
      break;
    // Exhaustiveness checking
    default: {
      const _: never = targetKind;
      break;
    }
  }

  return nameParts.map((namePart, idx) => ({ name: namePart, symbolKind: kindParts[idx] }));
}
