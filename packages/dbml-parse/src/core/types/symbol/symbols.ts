import { DEFAULT_SCHEMA_NAME } from '@/constants';
import type { Filepath } from '@/core/types/filepath';
import type { Internable } from '@/core/types/internable';
import { UNHANDLED } from '@/core/types/module';
import type Compiler from '@/compiler';
import type { CanonicalName } from '@/compiler/queries/canonicalName';
import { MetadataKind } from '@/core/types/symbol/metadata';
import type { TableChecksMetadata, NodeMetadata, IndexesMetadata } from '@/core/types/symbol/metadata';
import type { TokenPosition } from '@/core/types/schemaJson';
import { SettingName } from '@/core/types/keywords';
import { extractQuotedStringToken } from '@/core/utils/expression';
import { isValidPartialInjection } from '@/core/utils/validate';
import type { Settings } from '@/core/utils/validate';
import {
  extractColor, getTokenPosition, normalizeNote, processColumnType, processDefaultValue,
} from '@/core/utils/interpret';
import {
  FunctionApplicationNode,
  type PrefixExpressionNode,
  type ProgramNode,
  type SyntaxNode,
  UseDeclarationNode,
  type UseSpecifierNode,
  type WildcardNode,
  type ElementDeclarationNode,
} from '@/core/types/nodes';

export enum SymbolKind {
  Schema = 'Schema',

  Table = 'Table',
  Column = 'Column',

  TableGroup = 'TableGroup',
  TableGroupField = 'TableGroup field',

  Enum = 'Enum',
  EnumField = 'Enum field',

  StickyNote = 'Note',

  TablePartial = 'TablePartial',
  PartialInjection = 'PartialInjection',

  DiagramView = 'DiagramView',
  DiagramViewTopLevelWildcard = 'DiagramView top-level wildcard',
  DiagramViewTable = 'DiagramView table',
  DiagramViewTableGroup = 'DiagramView tablegroup',
  DiagramViewNote = 'DiagramView note',
  DiagramViewSchema = 'DiagramView schema',

  Program = 'Program',
}

// Allowable import kinds for use declaration
export const ImportKind = {
  Table: SymbolKind.Table,
  Enum: SymbolKind.Enum,
  TableGroup: SymbolKind.TableGroup,
  TablePartial: SymbolKind.TablePartial,
  Note: SymbolKind.StickyNote,
  Schema: SymbolKind.Schema,
};
export type ImportKind = (typeof ImportKind)[keyof typeof ImportKind];

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

// Base class for all symbols in the symbol graph
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

  // Return the canonical name from the file's perspective
  canonicalName (compiler: Compiler, filepath: Filepath): CanonicalName | undefined {
    return compiler.canonicalName(filepath, this).getValue();
  }

  // Return the interpreted name: canonical name with DEFAULT_SCHEMA_NAME converted to null.
  interpretedName (compiler: Compiler, filepath: Filepath): {
    schema: string | null;
    name: string;
  } {
    if (!filepath) return {
      schema: null,
      name: this.name ?? '',
    };
    const canonical = this.canonicalName(compiler, filepath);
    if (!canonical) return {
      schema: null,
      name: this.name ?? '',
    };
    return {
      schema: canonical.schema === DEFAULT_SCHEMA_NAME ? null : canonical.schema,
      name: canonical.name,
    };
  }

  // Return parsed settings for this symbol's declaration node.
  settings (compiler: Compiler): Settings | undefined {
    if (!this.declaration) return undefined;
    return compiler.nodeSettings(this.declaration).getFiltered(UNHANDLED);
  }

  get token (): TokenPosition | undefined {
    if (!this.declaration) return undefined;
    return getTokenPosition(this.declaration);
  }

  references (compiler: Compiler): SyntaxNode[] {
    return compiler.symbolReferences(this);
  }

  metadata (compiler: Compiler): NodeMetadata[] {
    return compiler.symbolMetadata(this);
  }

  members (compiler: Compiler): NodeSymbol[] {
    const result = compiler.symbolMembers(this);
    if (result.hasValue(UNHANDLED)) return [];
    return result.getValue();
  }
}

// Schema namespace
// Nestable via `parent`
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

  isPublicSchema (): this is SchemaSymbol & { name: typeof DEFAULT_SCHEMA_NAME } {
    return this.qualifiedName.join('.') === DEFAULT_SCHEMA_NAME;
  }

  // Whether a symbol is in some nested schema
  inNestedSchema (compiler: Compiler, nodeSymbol: NodeSymbol): boolean {
    const members = this.members(compiler);
    if (members.some((m) => m.originalSymbol === nodeSymbol.originalSymbol)) return true;
    for (const m of members) {
      if (m instanceof SchemaSymbol && m.inNestedSchema(compiler, nodeSymbol)) return true;
    }
    return false;
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

  note (compiler: Compiler): {
    value: string;
    token: TokenPosition;
  } | undefined {
    if (!this.declaration) return undefined;
    const s = compiler.nodeSettings(this.declaration).getFiltered(UNHANDLED);
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

  schema (compiler: Compiler): string | null {
    const canonical = this.canonicalName(compiler, this.filepath);
    if (!canonical) return null;
    return canonical.schema === DEFAULT_SCHEMA_NAME ? null : canonical.schema;
  }

  columns (compiler: Compiler): ColumnSymbol[] {
    return this.mergedColumns(compiler).filter((m) => !(m instanceof InjectedColumnSymbol));
  }

  mergedColumns (compiler: Compiler): (ColumnSymbol | InjectedColumnSymbol)[] {
    return this.members(compiler).filter((m): m is ColumnSymbol => m.isKind(SymbolKind.Column));
  }

  partialInjections (compiler: Compiler): NodeSymbol[] {
    return this.members(compiler).filter((m) => m.isKind(SymbolKind.PartialInjection));
  }

  note (compiler: Compiler): {
    value: string;
    token: TokenPosition;
  } | undefined {
    if (!this.declaration) return undefined;
    const s = compiler.nodeSettings(this.declaration).getFiltered(UNHANDLED);
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

  headercolor (compiler: Compiler): string | undefined {
    if (!this.declaration) return undefined;
    const s = compiler.nodeSettings(this.declaration).getFiltered(UNHANDLED);
    return s?.[SettingName.HeaderColor]?.length
      ? extractColor(s[SettingName.HeaderColor].at(0)?.value)
      : undefined;
  }

  refs (compiler: Compiler) {
    return this.metadata(compiler).filter((m): m is Extract<NodeMetadata, { kind: MetadataKind.Ref }> => m.kind === MetadataKind.Ref);
  }

  checks (compiler: Compiler) {
    return this.metadata(compiler).filter((m): m is Extract<NodeMetadata, { kind: MetadataKind.TableChecks }> => m.kind === MetadataKind.TableChecks);
  }

  indexes (compiler: Compiler) {
    return this.metadata(compiler).filter((m): m is Extract<NodeMetadata, { kind: MetadataKind.Indexes }> => m.kind === MetadataKind.Indexes);
  }

  records (compiler: Compiler) {
    return this.metadata(compiler).filter((m): m is Extract<NodeMetadata, { kind: MetadataKind.Records }> => m.kind === MetadataKind.Records);
  }

  resolvedPartials (compiler: Compiler): NodeSymbol[] {
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

  mergedIndexes (compiler: Compiler): IndexesMetadata[] {
    const own = this.indexes(compiler);
    const fromPartials = this.resolvedPartials(compiler).flatMap((p) =>
      p.metadata(compiler).filter((m): m is IndexesMetadata => m.kind === MetadataKind.Indexes));
    return [
      ...own,
      ...fromPartials,
    ];
  }

  mergedChecks (compiler: Compiler): TableChecksMetadata[] {
    const own = this.checks(compiler);
    const fromPartials = this.resolvedPartials(compiler).flatMap((p) =>
      p.metadata(compiler).filter((m): m is TableChecksMetadata => m.kind === MetadataKind.TableChecks));
    return [
      ...own,
      ...fromPartials,
    ];
  }

  mergedHeadercolor (compiler: Compiler): string | undefined {
    let color = this.headercolor(compiler);
    for (const partial of this.resolvedPartials(compiler)) {
      if (!partial.declaration) continue;
      const s = compiler.nodeSettings(partial.declaration).getFiltered(UNHANDLED);
      if (s?.[SettingName.HeaderColor]?.length) {
        color = extractColor(s[SettingName.HeaderColor].at(0)?.value);
      }
    }
    return color;
  }

  mergedNote (compiler: Compiler): {
    value: string;
    token: TokenPosition;
  } | undefined {
    const extractNote = (sym: NodeSymbol) => {
      if (!sym.declaration) return undefined;
      const s = compiler.nodeSettings(sym.declaration).getFiltered(UNHANDLED);
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
    };
    let note = extractNote(this);
    for (const partial of this.resolvedPartials(compiler)) {
      const partialNote = extractNote(partial);
      if (partialNote) note = partialNote;
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
    if (!this.declaration) return false;
    const s = compiler.nodeSettings(this.declaration).getFiltered(UNHANDLED);

    return !!(s?.[SettingName.PK]?.length || s?.[SettingName.PrimaryKey]?.length);
  }

  unique (compiler: Compiler): boolean {
    if (!this.declaration) return false;
    const s = compiler.nodeSettings(this.declaration).getFiltered(UNHANDLED);

    return !!s?.[SettingName.Unique]?.length;
  }

  nullable (compiler: Compiler): boolean | undefined {
    if (!this.declaration) return undefined;
    const s = compiler.nodeSettings(this.declaration).getFiltered(UNHANDLED);

    if (s?.[SettingName.NotNull]?.length) return false;
    if (s?.[SettingName.Null]?.length) return true;
    return undefined;
  }

  increment (compiler: Compiler): boolean {
    if (!this.declaration) return false;
    const s = compiler.nodeSettings(this.declaration).getFiltered(UNHANDLED);

    return !!s?.[SettingName.Increment]?.length;
  }

  default (compiler: Compiler): {
    type: 'number' | 'string' | 'boolean' | 'expression';
    value: string | number;
  } | undefined {
    if (!this.declaration) return undefined;
    const s = compiler.nodeSettings(this.declaration).getFiltered(UNHANDLED);

    const val = s?.[SettingName.Default]?.at(0)?.value;
    if (!val) return undefined;
    return processDefaultValue(val);
  }

  type (compiler: Compiler): {
    name: string;
    enumSymbol?: EnumSymbol;
    args?: (string | number)[];
    schema?: string;
    array?: (string | number | undefined)[];
  } | undefined {
    if (!(this.declaration instanceof FunctionApplicationNode)) return undefined;
    const raw = processColumnType(compiler, this.declaration.args[0]).getValue();
    if (!raw) return undefined;

    const args = raw.args
      ? raw.args.split(',').map((a) => { const n = Number(a); return Number.isNaN(n) ? a : n; })
      : undefined;

    const arrayParts: (string | number | undefined)[] = [];
    const bracketRegex = /\[([^\]]*)\]/g;
    let match: RegExpExecArray | null;
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
      enumSymbol: referee instanceof EnumSymbol ? referee : undefined,
      args: args?.length ? args : undefined,
      schema: raw.schemaName ?? undefined,
      array: arrayParts.length ? arrayParts : undefined,
    };
  }

  checks (compiler: Compiler): TableChecksMetadata[] {
    return this.metadata(compiler).filter((m): m is TableChecksMetadata => m.kind === MetadataKind.TableChecks);
  }

  note (compiler: Compiler): {
    value: string;
    token: TokenPosition;
  } | undefined {
    if (!this.declaration) return undefined;
    const s = compiler.nodeSettings(this.declaration).getFiltered(UNHANDLED);
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
    if (!this.declaration) return undefined;
    const s = compiler.nodeSettings(this.declaration).getFiltered(UNHANDLED);
    return s?.color?.length ? extractColor(s.color.at(0)?.value) : undefined;
  }

  note (compiler: Compiler): {
    value: string;
    token: TokenPosition;
  } | undefined {
    if (!this.declaration) return undefined;
    const s = compiler.nodeSettings(this.declaration).getFiltered(UNHANDLED);
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
      kind: SymbolKind.StickyNote,
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
  declare declaration: ProgramNode;

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

  // Whether a symbol is in this program or some nested schema
  inNestedSchema (compiler: Compiler, nodeSymbol: NodeSymbol): boolean {
    const members = this.members(compiler);
    if (members.some((m) => m.originalSymbol === nodeSymbol.originalSymbol)) return true;
    for (const m of members) {
      if (m instanceof SchemaSymbol && m.inNestedSchema(compiler, nodeSymbol)) return true;
    }
    return false;
  }
}

// `as` alias (e.g. `Table users as u`)
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

// `use`/`reuse` import. Only `reuse` is re-exportable
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

// Column injected from a TablePartial
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
