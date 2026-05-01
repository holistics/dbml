import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';
import type {
  Filepath,
} from '@/core/types/filepath';
import type {
  Internable,
} from '@/core/types/internable';
import {
  UNHANDLED,
} from '@/core/types/module';
import type Compiler from '@/compiler';
import {
  MetadataKind,
} from '@/core/types/metadata';
import type {
  CheckMetadata, IndexMetadata, SymbolMetadata,
} from '@/core/types/metadata';
import type {
  TokenPosition,
} from '@/core/types/schemaJson';
import {
  SettingName,
} from '@/core/types/keywords';
import {
  extractQuotedStringToken,
} from '@/core/utils/expression';
import {
  isValidPartialInjection,
} from '@/core/utils/validate';
import {
  parseColor, getTokenPosition, normalizeNote, processColumnType, processDefaultValue,
} from '@/core/utils/interpret';
import {
  type AttributeNode,
  FunctionApplicationNode,
  type FunctionExpressionNode,
  type PrefixExpressionNode,
  type SyntaxNode,
  UseDeclarationNode,
  type UseSpecifierNode,
  type WildcardNode,
  ElementDeclarationNode,
} from '@/core/types/nodes';

export enum SymbolKind {
  Schema = 'Schema',

  Table = 'Table',
  Column = 'Column',

  TableGroup = 'TableGroup',
  TableGroupField = 'TableGroup field',

  Enum = 'Enum',
  EnumField = 'Enum field',

  Note = 'Note',

  TablePartial = 'TablePartial',
  PartialInjection = 'PartialInjection',

  Indexes = 'Indexes',

  DiagramView = 'DiagramView',
  DiagramViewTopLevelWildcard = 'DiagramView top-level wildcard',
  DiagramViewTable = 'DiagramView table',
  DiagramViewTableGroup = 'DiagramView tablegroup',
  DiagramViewNote = 'DiagramView note',
  DiagramViewSchema = 'DiagramView schema',

  Program = 'Program',
}

declare const __nodeSymbolBrand: unique symbol;
export type NodeSymbolId = number & { readonly [__nodeSymbolBrand]: true };

declare const __internedNodeSymbolBrand: unique symbol;
export type InternedNodeSymbol = string & { readonly [__internedNodeSymbolBrand]: true };

export class NodeSymbolIdGenerator {
  private id = 0;

  reset () {
    this.id = 0;
  }

  nextId (): NodeSymbolId {
    return this.id++ as NodeSymbolId;
  }
}

// Base class for all symbols in the symbol graph.
export abstract class NodeSymbol implements Internable<InternedNodeSymbol> {
  id: NodeSymbolId;
  kind: SymbolKind;
  declaration?: SyntaxNode;
  filepath: Filepath;
  name?: string;

  constructor ({
    kind,
    declaration,
    name,
  }: {
    kind: SymbolKind;
    declaration?: SyntaxNode;
    name?: string;
  }, id: NodeSymbolId, filepath: Filepath) {
    this.id = id;
    this.kind = kind;
    this.declaration = declaration;
    this.filepath = filepath;
    this.name = name;
  }

  abstract get canBeImported (): boolean;
  abstract get originalSymbol (): NodeSymbol;

  get originalFilepath (): Filepath {
    return this.originalSymbol.filepath;
  }

  intern (): InternedNodeSymbol {
    return `symbol@${this.filepath.intern()}:${this.id}` as InternedNodeSymbol;
  }

  isKind (...kinds: SymbolKind[]): boolean {
    return kinds.includes(this.kind);
  }

  isPublicSchema (): this is SchemaSymbol & { name: typeof DEFAULT_SCHEMA_NAME } {
    return false;
  }

  canonicalName (compiler: Compiler, filepath: Filepath): { schema: string;
    name: string; } | undefined {
    return compiler.canonicalName(filepath, this).getValue();
  }

  resolvedName (compiler: Compiler, filepath?: Filepath): { schema: string | null;
    name: string; } {
    const canonical = this.canonicalName(compiler, filepath ?? this.filepath);
    const schema = canonical?.schema || null;
    return {
      schema: schema === DEFAULT_SCHEMA_NAME ? null : schema,
      name: canonical?.name ?? this.name ?? '',
    };
  }

  fullname (compiler: Compiler): string[] | undefined {
    if (!this.declaration) return this.name
      ? [
          this.name,
        ]
      : undefined;
    return compiler.nodeFullname(this.declaration).getFiltered(UNHANDLED);
  }

  alias (compiler: Compiler): string | undefined {
    if (!this.declaration) return undefined;
    return compiler.nodeAlias(this.declaration).getFiltered(UNHANDLED) ?? undefined;
  }

  settings (compiler: Compiler): Record<string, any> | undefined {
    if (!this.declaration) return undefined;
    return compiler.nodeSettings(this.declaration).getFiltered(UNHANDLED);
  }

  get token (): TokenPosition | undefined {
    if (!this.declaration) return undefined;
    return getTokenPosition(this.declaration);
  }

  note (compiler: Compiler): { value: string;
    token: TokenPosition; } | undefined {
    const s = this.settings(compiler);
    if (!s?.note?.length) return undefined;
    const noteAttr = s.note[0];
    const raw = noteAttr?.value;
    if (!raw) return undefined;
    const text = normalizeNote(extractQuotedStringToken(raw)!);
    if (!text) return undefined;
    return {
      value: text,
      token: getTokenPosition(noteAttr),
    };
  }

  references (compiler: Compiler): SyntaxNode[] {
    return compiler.symbolReferences(this);
  }

  metadata (compiler: Compiler): SymbolMetadata[] {
    return compiler.symbolMetadata(this);
  }

  metadataOf<K extends SymbolMetadata['kind']> (compiler: Compiler, kind: K): Extract<SymbolMetadata, { kind: K }>[] {
    return this.metadata(compiler).filter((m): m is Extract<SymbolMetadata, { kind: K }> => m.kind === kind);
  }

  members (compiler: Compiler): NodeSymbol[] {
    const result = compiler.symbolMembers(this);
    if (result.hasValue(UNHANDLED)) return [];
    return result.getValue();
  }
}

// Schema namespace. Nestable via `parent`.
export class SchemaSymbol extends NodeSymbol {
  declare kind: SymbolKind.Schema;
  name: string;
  parent?: SchemaSymbol;

  constructor (
    {
      name,
      parent,
    }: {
      name?: string;
      parent?: SchemaSymbol;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.Schema,
    }, id, filepath);
    this.name = name ?? '';
    this.parent = parent;
  }

  override get canBeImported (): boolean {
    return true;
  }

  override get originalSymbol (): NodeSymbol {
    return this;
  }

  get qualifiedName (): string[] {
    if (!this.parent) return [
      this.name,
    ];
    return [
      ...this.parent.qualifiedName,
      this.name,
    ];
  }

  override isPublicSchema (): this is SchemaSymbol & { name: typeof DEFAULT_SCHEMA_NAME } {
    return this.qualifiedName.join('.') === DEFAULT_SCHEMA_NAME;
  }
}

export class EnumSymbol extends NodeSymbol {
  constructor (
    {
      declaration,
      name,
    }: {
      declaration?: SyntaxNode;
      name?: string;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.Enum,
      declaration,
      name,
    }, id, filepath);
  }

  override get canBeImported (): boolean {
    return true;
  }

  override get originalSymbol (): NodeSymbol {
    return this;
  }
}

export class EnumFieldSymbol extends NodeSymbol {
  constructor (
    {
      declaration,
      name,
    }: {
      declaration?: SyntaxNode;
      name?: string;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.EnumField,
      declaration,
      name,
    }, id, filepath);
  }

  override get canBeImported (): boolean {
    return false;
  }

  override get originalSymbol (): NodeSymbol {
    return this;
  }
}

export class TableSymbol extends NodeSymbol {
  constructor (
    {
      declaration,
      name,
    }: {
      declaration?: SyntaxNode;
      name?: string;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.Table,
      declaration,
      name,
    }, id, filepath);
  }

  override get canBeImported (): boolean {
    return true;
  }

  override get originalSymbol (): NodeSymbol {
    return this;
  }

  schemaName (compiler: Compiler): string {
    return this.canonicalName(compiler, this.filepath)?.schema ?? DEFAULT_SCHEMA_NAME;
  }

  columns (compiler: Compiler): ColumnSymbol[] {
    const allColumns = this.members(compiler).filter((m): m is ColumnSymbol => m.isKind(SymbolKind.Column));
    // Direct columns win over injected; later injected overrides earlier
    const byName = new Map<string | undefined, ColumnSymbol>();
    for (const col of allColumns) {
      const isDirect = !(col instanceof InjectedColumnSymbol);
      if (isDirect || !byName.has(col.name) || byName.get(col.name) instanceof InjectedColumnSymbol) {
        byName.set(col.name, col);
      }
    }
    return allColumns.filter((c) => byName.get(c.name) === c);
  }

  partialInjections (compiler: Compiler): NodeSymbol[] {
    return this.members(compiler).filter((m) => m.isKind(SymbolKind.PartialInjection));
  }

  headerColor (compiler: Compiler): string | undefined {
    const s = this.settings(compiler);
    return s?.[SettingName.HeaderColor]?.length
      ? parseColor(s[SettingName.HeaderColor].at(0)?.value)
      : undefined;
  }

  refs (compiler: Compiler) { return this.metadataOf(compiler, MetadataKind.Ref); }
  checks (compiler: Compiler) { return this.metadataOf(compiler, MetadataKind.Check); }
  indexes (compiler: Compiler) { return this.metadataOf(compiler, MetadataKind.Index); }
  records (compiler: Compiler) { return this.metadataOf(compiler, MetadataKind.Record); }

  private partialSymbols (compiler: Compiler): NodeSymbol[] {
    return this.partialInjections(compiler).flatMap((injection) => {
      if (!(injection.declaration instanceof FunctionApplicationNode)) return [];
      if (!isValidPartialInjection(injection.declaration.callee)) return [];
      const expr = (injection.declaration.callee as PrefixExpressionNode).expression;
      if (!expr) return [];
      const partialSymbol = compiler.nodeReferee(expr).getFiltered(UNHANDLED);
      if (!partialSymbol) return [];
      return [
        partialSymbol,
      ];
    });
  }

  private mergedMetadataOf<K extends SymbolMetadata['kind']> (compiler: Compiler, kind: K): Extract<SymbolMetadata, { kind: K }>[] {
    const own = this.metadataOf(compiler, kind);
    const fromPartials = this.partialSymbols(compiler).flatMap((p) => p.metadataOf(compiler, kind));
    return [
      ...own,
      ...fromPartials,
    ];
  }

  mergedIndexes (compiler: Compiler): IndexMetadata[] { return this.mergedMetadataOf(compiler, MetadataKind.Index); }
  mergedChecks (compiler: Compiler): CheckMetadata[] { return this.mergedMetadataOf(compiler, MetadataKind.Check); }

  mergedHeaderColor (compiler: Compiler): string | undefined {
    let color = this.headerColor(compiler);
    for (const partial of this.partialSymbols(compiler)) {
      const s = partial.settings(compiler);
      if (s?.[SettingName.HeaderColor]?.length) {
        color = parseColor(s[SettingName.HeaderColor].at(0)?.value);
      }
    }
    return color;
  }

  mergedNote (compiler: Compiler): {
    value: string;
    token: TokenPosition;
  } | undefined {
    let note = this.note(compiler);
    for (const partial of this.partialSymbols(compiler)) {
      const partialNote = partial.note(compiler);
      if (partialNote) {
        note = partialNote;
      }
    }
    return note;
  }
}

export class ColumnSymbol extends NodeSymbol {
  constructor (
    {
      declaration,
      name,
    }: {
      declaration?: SyntaxNode;
      name?: string;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.Column,
      declaration,
      name,
    }, id, filepath);
  }

  override get canBeImported (): boolean {
    return false;
  }

  override get originalSymbol (): NodeSymbol {
    return this;
  }

  pk (compiler: Compiler): boolean {
    const s = this.settings(compiler);
    return !!(s?.[SettingName.PK]?.length || s?.[SettingName.PrimaryKey]?.length);
  }

  unique (compiler: Compiler): boolean {
    const s = this.settings(compiler);
    return !!s?.[SettingName.Unique]?.length;
  }

  nullable (compiler: Compiler): boolean | undefined {
    const s = this.settings(compiler);
    if (s?.[SettingName.NotNull]?.length) return false;
    if (s?.[SettingName.Null]?.length) return true;
    return undefined;
  }

  increment (compiler: Compiler): boolean {
    const s = this.settings(compiler);
    return !!s?.[SettingName.Increment]?.length;
  }

  default (compiler: Compiler): { type: 'number' | 'string' | 'boolean' | 'expression';
    value: string | number; } | undefined {
    const s = this.settings(compiler);
    const val = s?.[SettingName.Default]?.at(0)?.value;
    if (!val) return undefined;
    return processDefaultValue(val);
  }

  type (compiler: Compiler): ColumnTypeInfo | undefined {
    if (!(this.declaration instanceof FunctionApplicationNode)) return undefined;
    const raw = processColumnType(compiler, this.declaration.args[0]).getValue();
    if (!raw) return undefined;

    // Parse args: "10,2" -> [10, 2], "a,b" -> ["a", "b"]
    const args = raw.args
      ? raw.args.split(',').map((a) => { const n = Number(a); return Number.isNaN(n) ? a : n; })
      : undefined;

    // Parse array from type_name: "int[]" -> baseName "int", array [undefined]
    //                              "int[256]" -> baseName "int", array [256]
    //                              "int[][]" -> baseName "int", array [undefined, undefined]
    const arrayParts: (string | number | undefined)[] = [];
    const bracketRegex = /\[([^\]]*)\]/g;
    let match;
    const typeName = raw.type_name;
    while ((match = bracketRegex.exec(typeName)) !== null) {
      const inner = match[1];
      if (inner === '') arrayParts.push(undefined);
      else { const n = Number(inner); arrayParts.push(Number.isNaN(n) ? inner : n); }
    }
    const baseName = typeName.replace(/\[[^\]]*\]/g, '');

    const referee = compiler.nodeReferee(this.declaration.args[0]).getFiltered(UNHANDLED);
    return {
      name: baseName,
      symbol: referee instanceof EnumSymbol ? referee : undefined,
      args: args?.length ? args : undefined,
      schema: raw.schemaName ?? undefined,
      array: arrayParts.length ? arrayParts : undefined,
    };
  }

  inlineRefs (compiler: Compiler): { target: NodeSymbol;
    relation: string;
    token: TokenPosition; }[] {
    const s = this.settings(compiler);
    return (s?.[SettingName.Ref] ?? []).flatMap((attr: AttributeNode) => {
      const prefixExpr = attr.value as PrefixExpressionNode;
      if (!prefixExpr?.expression) return [];
      const target = compiler.nodeReferee(prefixExpr.expression).getFiltered(UNHANDLED);
      if (!target) return [];
      return [
        {
          target,
          relation: prefixExpr.op?.value ?? '',
          token: getTokenPosition(attr),
        },
      ];
    });
  }

  checks (compiler: Compiler): { expression: string;
    token: TokenPosition; }[] {
    const s = this.settings(compiler);
    return (s?.[SettingName.Check] ?? []).flatMap((attr: AttributeNode) => {
      const funcExpr = attr.value as FunctionExpressionNode;
      if (!funcExpr?.value?.value) return [];
      return [
        {
          expression: funcExpr.value.value,
          token: getTokenPosition(attr),
        },
      ];
    });
  }
}

export interface ColumnTypeInfo {
  name: string;
  symbol?: EnumSymbol;
  args?: (string | number)[];
  schema?: string;
  array?: (string | number | undefined)[]; // e.g. [undefined] for [], [256] for [256], [undefined, undefined] for [][]
}

export class TableGroupSymbol extends NodeSymbol {
  constructor (
    {
      declaration,
      name,
    }: {
      declaration?: SyntaxNode;
      name?: string;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.TableGroup,
      declaration,
      name,
    }, id, filepath);
  }

  override get canBeImported (): boolean {
    return true;
  }

  override get originalSymbol (): NodeSymbol {
    return this;
  }

  fields (compiler: Compiler): TableGroupFieldSymbol[] {
    return this.members(compiler).filter((m): m is TableGroupFieldSymbol => m.isKind(SymbolKind.TableGroupField));
  }

  color (compiler: Compiler): string | undefined {
    const s = this.settings(compiler);
    return s?.color?.length ? parseColor(s.color.at(0)?.value) : undefined;
  }
}

export class TableGroupFieldSymbol extends NodeSymbol {
  constructor (
    {
      declaration,
      name,
    }: {
      declaration?: SyntaxNode;
      name?: string;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.TableGroupField,
      declaration,
      name,
    }, id, filepath);
  }

  override get canBeImported (): boolean {
    return false;
  }

  override get originalSymbol (): NodeSymbol {
    return this;
  }
}

export class NoteSymbol extends NodeSymbol {
  constructor (
    {
      declaration,
      name,
    }: {
      declaration?: SyntaxNode;
      name?: string;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.Note,
      declaration,
      name,
    }, id, filepath);
  }

  override get canBeImported (): boolean {
    return true;
  }

  override get originalSymbol (): NodeSymbol {
    return this;
  }
}

export class TablePartialSymbol extends NodeSymbol {
  constructor (
    {
      declaration,
      name,
    }: {
      declaration?: SyntaxNode;
      name?: string;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.TablePartial,
      declaration,
      name,
    }, id, filepath);
  }

  override get canBeImported (): boolean {
    return true;
  }

  override get originalSymbol (): NodeSymbol {
    return this;
  }
}

export class PartialInjectionSymbol extends NodeSymbol {
  constructor (
    {
      declaration,
      name,
    }: {
      declaration?: SyntaxNode;
      name?: string;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.PartialInjection,
      declaration,
      name,
    }, id, filepath);
  }

  override get canBeImported (): boolean {
    return false;
  }

  override get originalSymbol (): NodeSymbol {
    return this;
  }
}


export class DiagramViewSymbol extends NodeSymbol {
  constructor (
    {
      declaration,
      name,
    }: {
      declaration?: SyntaxNode;
      name?: string;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.DiagramView,
      declaration,
      name,
    }, id, filepath);
  }

  override get canBeImported (): boolean {
    return false;
  }

  override get originalSymbol (): NodeSymbol {
    return this;
  }
}

export class DiagramViewTopLevelWildcardSymbol extends NodeSymbol {
  constructor (
    {
      declaration,
      name,
    }: {
      declaration?: SyntaxNode;
      name?: string;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.DiagramViewTopLevelWildcard,
      declaration,
      name,
    }, id, filepath);
  }

  override get canBeImported (): boolean {
    return false;
  }

  override get originalSymbol (): NodeSymbol {
    return this;
  }
}

export class DiagramViewTableSymbol extends NodeSymbol {
  constructor (
    {
      declaration,
      name,
    }: {
      declaration?: SyntaxNode;
      name?: string;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.DiagramViewTable,
      declaration,
      name,
    }, id, filepath);
  }

  override get canBeImported (): boolean {
    return false;
  }

  override get originalSymbol (): NodeSymbol {
    return this;
  }
}

export class DiagramViewTableGroupSymbol extends NodeSymbol {
  constructor (
    {
      declaration,
      name,
    }: {
      declaration?: SyntaxNode;
      name?: string;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.DiagramViewTableGroup,
      declaration,
      name,
    }, id, filepath);
  }

  override get canBeImported (): boolean {
    return false;
  }

  override get originalSymbol (): NodeSymbol {
    return this;
  }
}

export class DiagramViewNoteSymbol extends NodeSymbol {
  constructor (
    {
      declaration,
      name,
    }: {
      declaration?: SyntaxNode;
      name?: string;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.DiagramViewNote,
      declaration,
      name,
    }, id, filepath);
  }

  override get canBeImported (): boolean {
    return false;
  }

  override get originalSymbol (): NodeSymbol {
    return this;
  }
}

export class DiagramViewSchemaSymbol extends NodeSymbol {
  constructor (
    {
      declaration,
      name,
    }: {
      declaration?: SyntaxNode;
      name?: string;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.DiagramViewSchema,
      declaration,
      name,
    }, id, filepath);
  }

  override get canBeImported (): boolean {
    return false;
  }

  override get originalSymbol (): NodeSymbol {
    return this;
  }
}

export class ProgramSymbol extends NodeSymbol {
  constructor (
    {
      declaration,
      name,
    }: {
      declaration?: SyntaxNode;
      name?: string;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.Program,
      declaration,
      name,
    }, id, filepath);
  }

  override get canBeImported (): boolean {
    return false;
  }

  override get originalSymbol (): NodeSymbol {
    return this;
  }
}

// `as` alias (e.g. `Table users as u`). Delegates to aliasedSymbol.
export class AliasSymbol extends NodeSymbol {
  declare declaration: ElementDeclarationNode;
  declare name: string;
  aliasedSymbol: NodeSymbol;

  constructor ({
    kind,
    declaration,
    aliasedSymbol,
    name,
  }: {
    kind: SymbolKind;
    declaration?: ElementDeclarationNode;
    aliasedSymbol: NodeSymbol;
    name: string;
  }, id: NodeSymbolId, filepath: Filepath) {
    super({
      kind,
      declaration,
      name,
    }, id, filepath);
    this.aliasedSymbol = aliasedSymbol;
  }

  get canBeImported (): boolean {
    return this.aliasedSymbol.canBeImported;
  }

  get originalSymbol (): NodeSymbol {
    return this.aliasedSymbol.originalSymbol;
  }
}

// `use`/`reuse` import. Only `reuse` is re-exportable.
export class UseSymbol extends NodeSymbol {
  useSpecifierDeclaration: UseSpecifierNode | WildcardNode | undefined;
  usedSymbol?: NodeSymbol;

  constructor ({
    kind,
    declaration,
    useSpecifierDeclaration,
    usedSymbol,
    name,
  }: {
    kind: SymbolKind;
    declaration?: SyntaxNode;
    useSpecifierDeclaration: UseSpecifierNode | WildcardNode | undefined;
    usedSymbol?: NodeSymbol;
    name?: string;
  }, id: NodeSymbolId, filepath: Filepath) {
    super({
      kind,
      declaration,
      name,
    }, id, filepath);
    this.useSpecifierDeclaration = useSpecifierDeclaration;
    this.usedSymbol = usedSymbol;
  }

  get canBeImported (): boolean {
    const useDeclaration = this.useSpecifierDeclaration?.parentOfKind(UseDeclarationNode);
    const isReuse = !useDeclaration || useDeclaration.isReuse;
    return isReuse;
  }

  get originalSymbol (): NodeSymbol {
    if (!this.usedSymbol) return this;
    return this.usedSymbol.originalSymbol;
  }
}

// Column injected from a TablePartial. Carries own name to avoid scope mismatch.
export class InjectedColumnSymbol extends ColumnSymbol {
  declare name: string;
  injectionDeclaration: SyntaxNode;

  constructor (
    {
      declaration,
      name,
      injectionDeclaration,
    }: {
      kind: SymbolKind;
      declaration: SyntaxNode;
      injectionDeclaration: SyntaxNode;
      name: string;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      declaration,
      name,
    }, id, filepath);
    this.injectionDeclaration = injectionDeclaration;
    this.name = name;
  }
}
