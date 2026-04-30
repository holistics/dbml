// Pure collectors that turn per-tab data into Monaco decoration entries.
// Kept in a standalone module (rather than inside OutputPane.vue) so each
// tab owns its own decoration logic and the outer shell can stay thin.
//
// Colour assignments mirror the old `.hl-*` CSS layer one-for-one; only the
// alpha values are rounded to the nearest Tailwind-supported steps (/5 for
// backgrounds, /20 for outlines).

import {
  SymbolKind, SyntaxNodeKind,
} from '@dbml/parse';
import type {
  Database, SyntaxToken,
} from '@dbml/parse';
import * as monaco from 'monaco-editor';
import type {
  SymbolInfo,
} from '@/stores/parserStore';
import {
  tokenKindClass,
} from '@/components/panes/output/tokenIcons';
import {
  toMonacoRange,
} from '@/utils/monaco';

export interface DecorationEntry {
  range: monaco.IRange;
  cls: string;
}

export function collectTokenDecorations (tokens: readonly SyntaxToken[]): DecorationEntry[] {
  return tokens.map((t) => ({
    range: toMonacoRange(t.startPos, t.endPos),
    cls: tokenKindClass(t.kind),
  }));
}

const NODE_KIND_CLASS: Partial<Record<SyntaxNodeKind, string>> = {
  [SyntaxNodeKind.PROGRAM]: 'hl-node-program',
  [SyntaxNodeKind.ELEMENT_DECLARATION]: 'hl-node-element',

  [SyntaxNodeKind.USE_DECLARATION]: 'hl-node-use',
  [SyntaxNodeKind.USE_SPECIFIER]: 'hl-node-use-spec',
  [SyntaxNodeKind.USE_SPECIFIER_LIST]: 'hl-node-use-spec',

  [SyntaxNodeKind.ATTRIBUTE]: 'hl-node-attribute',
  [SyntaxNodeKind.IDENTIFIER_STREAM]: 'hl-node-id-stream',

  [SyntaxNodeKind.LITERAL]: 'hl-node-literal',
  [SyntaxNodeKind.VARIABLE]: 'hl-node-variable',
  [SyntaxNodeKind.PRIMARY_EXPRESSION]: 'hl-node-primary',

  [SyntaxNodeKind.PREFIX_EXPRESSION]: 'hl-node-arith',
  [SyntaxNodeKind.INFIX_EXPRESSION]: 'hl-node-arith',
  [SyntaxNodeKind.POSTFIX_EXPRESSION]: 'hl-node-arith',

  [SyntaxNodeKind.FUNCTION_EXPRESSION]: 'hl-node-function',
  [SyntaxNodeKind.FUNCTION_APPLICATION]: 'hl-node-fn-app',
  [SyntaxNodeKind.CALL_EXPRESSION]: 'hl-node-call',
  [SyntaxNodeKind.GROUP_EXPRESSION]: 'hl-node-primary',

  [SyntaxNodeKind.BLOCK_EXPRESSION]: 'hl-node-block',
  [SyntaxNodeKind.LIST_EXPRESSION]: 'hl-node-list',
  [SyntaxNodeKind.TUPLE_EXPRESSION]: 'hl-node-tuple',
  [SyntaxNodeKind.COMMA_EXPRESSION]: 'hl-node-primary',
  [SyntaxNodeKind.ARRAY]: 'hl-node-list',

  [SyntaxNodeKind.EMPTY]: 'hl-node-empty',
  [SyntaxNodeKind.WILDCARD]: 'hl-node-wildcard',
};

// ElementDeclaration gets its color from the element keyword (Table, Enum,
// TableGroup, ...) so an enum block shows green, a table block shows blue,
// matching the symbol icon colors in the output panel.
const ELEMENT_TYPE_CLASS: Record<string, string> = {
  Table: 'hl-element-table',
  TablePartial: 'hl-element-partial',
  Enum: 'hl-element-enum',
  TableGroup: 'hl-element-tablegroup',
  Note: 'hl-element-note',
  Ref: 'hl-element-ref',
  Indexes: 'hl-element-indexes',
  Project: 'hl-element-project',
  DiagramView: 'hl-element-diagram',
};

// Properties the walker should never follow — they point outside the
// syntax tree (symbols, parents, source text) and would loop forever.
const AST_WALK_SKIP_KEYS = new Set(['parentNode', 'parent', 'symbol', 'referee', 'source', 'filepath']);

// Soft cap so a pathological tree can't blow up Monaco's decoration model.
const AST_RANGE_LIMIT = 2000;

export function collectNodeDecorations (ast: unknown): DecorationEntry[] {
  const entries: DecorationEntry[] = [];
  const visited = new WeakSet<object>();
  function walk (node: unknown) {
    if (entries.length >= AST_RANGE_LIMIT) return;
    if (!node || typeof node !== 'object') return;
    if (visited.has(node)) return;
    visited.add(node);
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const obj = node as Record<string, unknown>;
    const sp = obj.startPos as {
      line?: number;
      column?: number;
    } | undefined;
    const ep = obj.endPos as {
      line?: number;
      column?: number;
    } | undefined;
    if (sp && ep && typeof sp.line === 'number' && !Number.isNaN(sp.line)
      && typeof ep.line === 'number' && !Number.isNaN(ep.line)) {
      let decoration = NODE_KIND_CLASS[obj.kind as SyntaxNodeKind] ?? null;
      if (obj.kind === SyntaxNodeKind.ELEMENT_DECLARATION) {
        const typeToken = obj.type as { value?: string } | undefined;
        const typeName = typeToken?.value;
        const normalized = Object.keys(ELEMENT_TYPE_CLASS).find(
          (k) => k.toLowerCase() === typeName?.toLowerCase(),
        );
        if (normalized) decoration = ELEMENT_TYPE_CLASS[normalized];
      }
      if (decoration) {
        entries.push({
          range: toMonacoRange({ line: sp.line, column: sp.column ?? 0 }, { line: ep.line, column: ep.column ?? 0 }),
          cls: decoration,
        });
      }
    }
    for (const [key, val] of Object.entries(obj)) {
      if (AST_WALK_SKIP_KEYS.has(key)) continue;
      walk(val);
    }
  }
  walk(ast);
  return entries;
}

export const SYM_KIND_CLASS: Partial<Record<SymbolKind, string>> = {
  [SymbolKind.Schema]: 'hl-sym-schema',

  [SymbolKind.Table]: 'hl-sym-table',
  [SymbolKind.Column]: 'hl-sym-column',

  [SymbolKind.TablePartial]: 'hl-sym-partial',
  [SymbolKind.PartialInjection]: 'hl-sym-partial',

  [SymbolKind.Enum]: 'hl-sym-enum',
  [SymbolKind.EnumField]: 'hl-sym-enum-field',

  [SymbolKind.TableGroup]: 'hl-sym-tablegroup',
  [SymbolKind.TableGroupField]: 'hl-sym-tablegroup-field',

  [SymbolKind.Note]: 'hl-sym-note',
  [SymbolKind.Indexes]: 'hl-sym-indexes',
  [SymbolKind.DiagramView]: 'hl-sym-indexes',
  [SymbolKind.DiagramViewTopLevelWildcard]: 'hl-sym-indexes',
  [SymbolKind.DiagramViewTable]: 'hl-sym-indexes',
  [SymbolKind.DiagramViewTableGroup]: 'hl-sym-indexes',
  [SymbolKind.DiagramViewNote]: 'hl-sym-indexes',
  [SymbolKind.DiagramViewSchema]: 'hl-sym-indexes',
};

export function collectSymbolDecorations (symbols: SymbolInfo[]): DecorationEntry[] {
  const result: DecorationEntry[] = [];
  function walk (sym: SymbolInfo) {
    // Program covers the entire file so its decoration would blanket
    // everything underneath — skip it.
    if (sym.declPos && sym.kind !== SymbolKind.Program) {
      result.push({
        range: new monaco.Range(sym.declPos.startLine, sym.declPos.startCol, sym.declPos.endLine, sym.declPos.endCol),
        cls: SYM_KIND_CLASS[sym.kind as SymbolKind] ?? '',
      });
    }
    sym.members.forEach(walk);
  }
  symbols.forEach(walk);
  return result;
}

type DbToken = { start: { line: number;
  column: number; };
end: { line: number;
  column: number; }; } | undefined;

export function collectDatabaseDecorations (db: Database | null): DecorationEntry[] {
  if (!db) return [];
  const result: DecorationEntry[] = [];
  function add (tp: DbToken, cls: string) {
    if (!tp) return;
    result.push({
      range: new monaco.Range(tp.start.line, tp.start.column, tp.end.line, tp.end.column),
      cls,
    });
  }
  for (const t of db.tables) { add(t.token, SYM_KIND_CLASS[SymbolKind.Table]!); }
  for (const r of db.refs) { add(r.token, SYM_KIND_CLASS[SymbolKind.Indexes]!); }
  for (const e of db.enums) { add(e.token, SYM_KIND_CLASS[SymbolKind.Enum]!); }
  for (const n of db.notes) { add(n.token, SYM_KIND_CLASS[SymbolKind.Note]!); }
  for (const tg of db.tableGroups) { add(tg.token, SYM_KIND_CLASS[SymbolKind.TableGroup]!); }
  for (const tp of db.tablePartials ?? []) { add((tp as { token?: DbToken }).token, SYM_KIND_CLASS[SymbolKind.TablePartial]!); }
  for (const rec of db.records ?? []) { add((rec as { token?: DbToken }).token, SYM_KIND_CLASS[SymbolKind.Note]!); }
  return result;
}
