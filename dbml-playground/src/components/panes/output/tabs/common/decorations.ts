// Pure collectors that turn per-tab data into Monaco decoration entries.
// Kept in a standalone module (rather than inside OutputPane.vue) so each
// tab owns its own decoration logic and the outer shell can stay thin.

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
} from '@/utils/tokenIcons';

export interface DecorationEntry {
  range: monaco.IRange;
  cls: string;
}

// Shared outline + rounded shell. Negative outline offset keeps the edge
// flush with the glyph so decorations feel soft instead of boxed-in — the
// previous CSS layer did the same via `outline-offset: -1px`.
export const DECORATION_SHELL = 'outline outline-1 outline-offset-[-1px] rounded-[2px]';

export function collectTokenDecorations (tokens: readonly SyntaxToken[]): DecorationEntry[] {
  return tokens.map((t) => ({
    range: new monaco.Range(
      t.startPos.line + 1,
      t.startPos.column + 1,
      t.endPos.line + 1,
      t.endPos.column + 1,
    ),
    cls: tokenKindClass(t.kind),
  }));
}

const NODE_KIND_CLASS: Partial<Record<SyntaxNodeKind, string>> = {
  [SyntaxNodeKind.ELEMENT_DECLARATION]: 'outline-blue-500/35 bg-blue-500/7',

  [SyntaxNodeKind.USE_DECLARATION]: 'outline-violet-500/35 bg-violet-500/7',
  [SyntaxNodeKind.USE_SPECIFIER]: 'outline-violet-500/35 bg-violet-500/7',
  [SyntaxNodeKind.USE_SPECIFIER_LIST]: 'outline-violet-500/35 bg-violet-500/7',

  [SyntaxNodeKind.ATTRIBUTE]: 'outline-orange-500/35 bg-orange-500/7',
  [SyntaxNodeKind.IDENTIFIER_STREAM]: 'outline-gray-500/35 bg-gray-500/7',

  [SyntaxNodeKind.LITERAL]: 'outline-green-600/35 bg-green-600/7',
  [SyntaxNodeKind.VARIABLE]: 'outline-cyan-500/35 bg-cyan-500/7',
  [SyntaxNodeKind.PRIMARY_EXPRESSION]: 'outline-sky-500/35 bg-sky-500/7',

  [SyntaxNodeKind.PREFIX_EXPRESSION]: 'outline-red-500/35 bg-red-500/7',
  [SyntaxNodeKind.INFIX_EXPRESSION]: 'outline-red-500/35 bg-red-500/7',
  [SyntaxNodeKind.POSTFIX_EXPRESSION]: 'outline-red-500/35 bg-red-500/7',

  [SyntaxNodeKind.FUNCTION_EXPRESSION]: 'outline-amber-500/35 bg-amber-500/7',
  [SyntaxNodeKind.FUNCTION_APPLICATION]: 'outline-yellow-600/35 bg-yellow-600/7',
  [SyntaxNodeKind.CALL_EXPRESSION]: 'outline-pink-500/35 bg-pink-500/7',
  [SyntaxNodeKind.GROUP_EXPRESSION]: 'outline-pink-500/35 bg-pink-500/7',

  [SyntaxNodeKind.BLOCK_EXPRESSION]: 'outline-indigo-500/35 bg-indigo-500/7',
  [SyntaxNodeKind.LIST_EXPRESSION]: 'outline-teal-500/35 bg-teal-500/7',
  [SyntaxNodeKind.TUPLE_EXPRESSION]: 'outline-teal-500/35 bg-teal-500/7',
  [SyntaxNodeKind.COMMA_EXPRESSION]: 'outline-teal-500/35 bg-teal-500/7',
  [SyntaxNodeKind.ARRAY]: 'outline-teal-500/35 bg-teal-500/7',
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
    const sp = obj.startPos as { line?: number;
      column?: number; } | null | undefined;
    const ep = obj.endPos as { line?: number;
      column?: number; } | null | undefined;
    if (sp && ep && typeof sp.line === 'number' && !Number.isNaN(sp.line)
      && typeof ep.line === 'number' && !Number.isNaN(ep.line)) {
      const cls = NODE_KIND_CLASS[obj.kind as SyntaxNodeKind] ?? null;
      if (cls) {
        entries.push({
          range: new monaco.Range(sp.line + 1, (sp.column ?? 0) + 1, ep.line + 1, (ep.column ?? 0) + 1),
          cls,
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
  [SymbolKind.Schema]: 'outline-orange-500/40 bg-orange-500/7',

  [SymbolKind.Table]: 'outline-blue-500/40 bg-blue-500/7',
  [SymbolKind.Column]: 'outline-gray-500/40 bg-gray-500/7',

  [SymbolKind.TablePartial]: 'outline-blue-500/40 bg-blue-500/7',
  [SymbolKind.PartialInjection]: 'outline-blue-500/40 bg-blue-500/7',

  [SymbolKind.Enum]: 'outline-green-600/40 bg-green-600/7',
  [SymbolKind.EnumField]: 'outline-green-500/40 bg-green-500/7',

  [SymbolKind.TableGroup]: 'outline-yellow-600/40 bg-yellow-600/7',
  [SymbolKind.TableGroupField]: 'outline-yellow-600/40 bg-yellow-600/7',

  [SymbolKind.Note]: 'outline-gray-500/40 bg-gray-500/7',
  [SymbolKind.Indexes]: 'outline-purple-500/40 bg-purple-500/7',
  [SymbolKind.DiagramView]: 'outline-purple-500/40 bg-purple-500/7',
};

export function collectSymbolDecorations (symbols: SymbolInfo[]): DecorationEntry[] {
  const result: DecorationEntry[] = [];
  function walk (sym: SymbolInfo) {
    if (sym.declPos) {
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
