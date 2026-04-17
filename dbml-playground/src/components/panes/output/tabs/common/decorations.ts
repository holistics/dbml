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
} from '@/utils/tokenIcons';

export interface DecorationEntry {
  range: monaco.IRange;
  cls: string;
}

// Shared outline + rounded shell. Negative outline offset pulls the stroke
// inward so decorations feel soft instead of boxed-in. The colour classes
// below are safelisted in `styles/main.css` — Tailwind's JIT scan can't see
// string literals that live in .ts files, so we tell it explicitly which
// utilities to generate.
export const DECORATION_SHELL = 'outline outline-1 -outline-offset-1 rounded-sm';

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
  [SyntaxNodeKind.ELEMENT_DECLARATION]: 'outline-blue-400/20 bg-blue-400/5',

  [SyntaxNodeKind.USE_DECLARATION]: 'outline-violet-400/20 bg-violet-400/5',
  [SyntaxNodeKind.USE_SPECIFIER]: 'outline-violet-400/20 bg-violet-400/5',
  [SyntaxNodeKind.USE_SPECIFIER_LIST]: 'outline-violet-400/20 bg-violet-400/5',

  [SyntaxNodeKind.ATTRIBUTE]: 'outline-orange-400/20 bg-orange-400/5',
  [SyntaxNodeKind.IDENTIFIER_STREAM]: 'outline-gray-400/20 bg-gray-400/5',

  [SyntaxNodeKind.LITERAL]: 'outline-green-500/20 bg-green-500/5',
  [SyntaxNodeKind.VARIABLE]: 'outline-cyan-400/20 bg-cyan-400/5',
  [SyntaxNodeKind.PRIMARY_EXPRESSION]: 'outline-sky-400/20 bg-sky-400/5',

  [SyntaxNodeKind.PREFIX_EXPRESSION]: 'outline-red-400/20 bg-red-400/5',
  [SyntaxNodeKind.INFIX_EXPRESSION]: 'outline-red-400/20 bg-red-400/5',
  [SyntaxNodeKind.POSTFIX_EXPRESSION]: 'outline-red-400/20 bg-red-400/5',

  [SyntaxNodeKind.FUNCTION_EXPRESSION]: 'outline-amber-400/20 bg-amber-400/5',
  [SyntaxNodeKind.FUNCTION_APPLICATION]: 'outline-yellow-500/20 bg-yellow-500/5',
  [SyntaxNodeKind.CALL_EXPRESSION]: 'outline-pink-400/20 bg-pink-400/5',
  [SyntaxNodeKind.GROUP_EXPRESSION]: 'outline-pink-400/20 bg-pink-400/5',

  [SyntaxNodeKind.BLOCK_EXPRESSION]: 'outline-indigo-400/20 bg-indigo-400/5',
  [SyntaxNodeKind.LIST_EXPRESSION]: 'outline-teal-400/20 bg-teal-400/5',
  [SyntaxNodeKind.TUPLE_EXPRESSION]: 'outline-teal-400/20 bg-teal-400/5',
  [SyntaxNodeKind.COMMA_EXPRESSION]: 'outline-teal-400/20 bg-teal-400/5',
  [SyntaxNodeKind.ARRAY]: 'outline-teal-400/20 bg-teal-400/5',

  [SyntaxNodeKind.EMPTY]: 'outline-gray-400/20 bg-gray-400/5',
  [SyntaxNodeKind.WILDCARD]: 'outline-yellow-500/20 bg-yellow-500/5',
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
    const sp = obj.startPos as { line?: number; column?: number } | null | undefined;
    const ep = obj.endPos as { line?: number; column?: number } | null | undefined;
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
  [SymbolKind.Schema]: 'outline-orange-400/20 bg-orange-400/5',

  [SymbolKind.Table]: 'outline-blue-400/20 bg-blue-400/5',
  [SymbolKind.Column]: 'outline-gray-400/20 bg-gray-400/5',

  [SymbolKind.TablePartial]: 'outline-blue-400/20 bg-blue-400/5',
  [SymbolKind.PartialInjection]: 'outline-blue-400/20 bg-blue-400/5',

  [SymbolKind.Enum]: 'outline-green-500/20 bg-green-500/5',
  [SymbolKind.EnumField]: 'outline-green-400/20 bg-green-400/5',

  [SymbolKind.TableGroup]: 'outline-yellow-500/20 bg-yellow-500/5',
  [SymbolKind.TableGroupField]: 'outline-yellow-500/20 bg-yellow-500/5',

  [SymbolKind.Note]: 'outline-gray-400/20 bg-gray-400/5',
  [SymbolKind.Indexes]: 'outline-purple-400/20 bg-purple-400/5',
  [SymbolKind.DiagramView]: 'outline-purple-400/20 bg-purple-400/5',
  [SymbolKind.DiagramViewTopLevelWildcard]: 'outline-purple-400/20 bg-purple-400/5',
  [SymbolKind.DiagramViewTable]: 'outline-purple-400/20 bg-purple-400/5',
  [SymbolKind.DiagramViewTableGroup]: 'outline-purple-400/20 bg-purple-400/5',
  [SymbolKind.DiagramViewNote]: 'outline-purple-400/20 bg-purple-400/5',
  [SymbolKind.DiagramViewSchema]: 'outline-purple-400/20 bg-purple-400/5',
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

type DbToken = { start: { line: number; column: number }; end: { line: number; column: number } } | undefined;

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
