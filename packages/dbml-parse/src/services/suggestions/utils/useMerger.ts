import type Compiler from '@/compiler';
import {
  SymbolKind,
} from '@/core/types';
import {
  Filepath,
} from '@/core/types/filepath';
import {
  ImportKind,
} from '@/core/types/keywords';
import {
  UseDeclarationNode, UseSpecifierListNode, VariableNode, WildcardNode,
} from '@/core/types/nodes';

// Maps a runtime SymbolKind ('Table', 'Enum', …) to its DBML import keyword
// ('table', 'enum', …). Without this the merged / created use statement
// produces `{ Table users }`, which doesn't parse.
function importKindFor (kind: SymbolKind): string | undefined {
  switch (kind) {
    case SymbolKind.Table: return ImportKind.Table;
    case SymbolKind.Enum: return ImportKind.Enum;
    case SymbolKind.TableGroup: return ImportKind.TableGroup;
    case SymbolKind.TablePartial: return ImportKind.TablePartial;
    case SymbolKind.Note: return ImportKind.Note;
    case SymbolKind.Schema: return ImportKind.Schema;
    default: return undefined;
  }
}

export interface ParsedUseSpecifier {
  kind?: string; // DBML import keyword: 'table' | 'enum' | ... (undefined if parser couldn't extract)
  name: string;  // bare symbol name, or '*' for wildcard
}

export interface ParsedUseStatement {
  startOffset: number;
  endOffset: number;
  sourceFile: string; // e.g., './common'
  specifiers: ParsedUseSpecifier[];
  node: UseDeclarationNode; // Original AST node for precise source tracking
}

export interface UseStatementMergeResult {
  // Use statement to prepend at the top of the file. Always ends with at
  // least one trailing blank line so it doesn't collide with whatever
  // element declaration appears right after it.
  topInsert: string;
  // Source range of an old `use { ... } from '...'` to delete when merging.
  // Absent on the create-new path (no existing use matched the source file).
  removeRange?: { startOffset: number; endOffset: number };
  hint?: string; // 'merged into existing' | 'created new' | 'symbol already imported'
}

/**
   * Scan existing use statements in file using compiler AST.
   * This is precise and avoids regex false positives (e.g., in comments).
   */
export function scanExistingUses (
  compiler: Compiler,
  filepath: Filepath,
  fileContent: string,
): ParsedUseStatement[] {
  const results: ParsedUseStatement[] = [];

  // Parse the file to get the AST (proceed even if there are errors - use statements
  // parsed before the first error are still usable)
  const parseResult = compiler.parseFile(filepath);
  const ast = parseResult.getValue()?.ast;
  if (!ast) return results;

  // Extract use statements from the program node
  for (const useNode of ast.uses) {
    // Prefer AST-parsed importPath; fall back to scanning the source text for `from '...'`
    let sourceFile = useNode.importPath?.value ?? '';
    if (!sourceFile) {
      // The parser may not have reached the `from` clause due to specifier errors.
      // Use the actual `use` keyword token position (not fullStart, which includes leading trivia)
      // to find the line containing the use statement.
      const useKeywordStart = useNode.useKeyword?.start ?? useNode.fullStart;
      const lineStart = fileContent.lastIndexOf('\n', useKeywordStart - 1) + 1;
      const lineEnd = fileContent.indexOf('\n', useKeywordStart);
      const line = fileContent.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
      const fromMatch = line.match(/from\s*(['"])(.*?)\1/);
      if (fromMatch) {
        sourceFile = fromMatch[2];
      }
    }
    const specifiers: ParsedUseSpecifier[] = [];

    if (useNode.specifiers instanceof UseSpecifierListNode) {
      const IMPORT_KIND_KEYWORDS = new Set([
        'table', 'enum', 'tablepartial', 'tablegroup', 'note', 'schema', 'from',
      ]);
      for (const specifier of useNode.specifiers.specifiers) {
        let kind: string | undefined;
        let name: string | undefined;

        if (specifier.name) {
          // Fully formed: `use { table users }`
          kind = specifier.importKind?.value;
          name = extractSymbolName(specifier.name);
          if (!name && specifier.name.start !== undefined && specifier.name.end !== undefined) {
            name = fileContent.slice(specifier.name.start, specifier.name.end).trim();
          }
        } else if (specifier.importKind) {
          // Parse recovery: `use { User }` — "kind slot" holds the symbol name.
          const val = specifier.importKind.value ?? undefined;
          if (val && !IMPORT_KIND_KEYWORDS.has(val.toLowerCase())) {
            name = val;
          }
        }

        if (name && name.toLowerCase() !== 'from') {
          specifiers.push({ kind, name });
        }
      }
    } else if (useNode.specifiers instanceof WildcardNode) {
      specifiers.push({ name: '*' });
    }

    if (specifiers.length === 0 && !(useNode.specifiers instanceof WildcardNode)) {
      continue;
    }

    // When the AST node ends before the full `use { ... } from '...'` statement
    // (parse error recovery truncates the node), extend endOffset to cover the
    // full statement including the `from '...'` clause.
    let endOffset = useNode.fullEnd;
    if (!useNode.importPath) {
      const useKeywordStart = useNode.useKeyword?.start ?? useNode.fullStart;
      const lineEnd = fileContent.indexOf('\n', useKeywordStart);
      endOffset = lineEnd === -1 ? fileContent.length : lineEnd;
    }

    results.push({
      startOffset: useNode.fullStart,
      endOffset,
      sourceFile,
      specifiers,
      node: useNode,
    });
  }

  return results;
}

/**
   * Extract the symbol name string from a specifier's name expression node.
   *
   * The AST shape varies depending on how complete the parse is:
   *   1. `VariableNode` with a `variable` token — the normal, fully-parsed case.
   *   2. Node with a `.variable.value` string — produced by some parser recovery paths.
   *   3. Node with a `.value` string — token-level nodes (e.g. SyntaxToken directly).
   *   4. Node with a `.name` string — rare structural variant.
   *   5. Source-text slice via `.source` + `.start`/`.end` — last resort when the
   *      node carries no parsed text; used when the parser recovered with partial info.
   *
   * Branches are tried in order of specificity; the first match wins. The `any`
   * parameter type is intentional — specifier name nodes may be any expression
   * subtype and the concrete type is not narrowed at the call site.
   */
function extractSymbolName (node: any): string | undefined {
  if (!node) return undefined;

  // 1. Canonical case: fully-parsed VariableNode
  if (node instanceof VariableNode && node.variable) {
    return node.variable.value ?? undefined;
  }

  // 2. Parser recovery: node has a `variable` sub-token
  if (node.variable && typeof node.variable.value === 'string') {
    return node.variable.value;
  }

  // 3. Token-level node: carries its lexeme in `.value`
  if (typeof node.value === 'string') {
    return node.value;
  }

  // 4. Structural variant: name stored directly as a string property
  if (typeof node.name === 'string') {
    return node.name;
  }

  // Fallback: try to extract from source text
  if (node.source && typeof node.start === 'number' && typeof node.end === 'number') {
    const text = node.source.slice(node.start, node.end);
    return text.trim() || undefined;
  }

  return undefined;
}

/**
   * Merge a new symbol into the file's use statements.
   * If a use from sourceFile exists, add the symbol to it.
   * If not, create a new use statement at the top.
   */
export function mergeSymbolIntoUses (
  compiler: Compiler,
  filepath: Filepath,
  fileContent: string,
  symbolKind: SymbolKind,
  symbolName: string,
  sourceFile: Filepath,
): UseStatementMergeResult {
  const existingUses = scanExistingUses(compiler, filepath, fileContent);

  // Normalize source file path: '/path/to/common' → './common'
  const sourceFileStr = normalizeSourcePath(sourceFile);

  // Look for existing use from this source file
  const existingUseIndex = existingUses.findIndex((u) => u.sourceFile === sourceFileStr);

  const importKeyword = importKindFor(symbolKind) ?? symbolKind.toString().toLowerCase();
  const newSpecifier = `${importKeyword} ${symbolName}`;
  const lineEnd = detectLineEnding(fileContent);

  if (existingUseIndex !== -1) {
    const existingUse = existingUses[existingUseIndex];

    // Duplicate — nothing to do. Surface no edit.
    if (existingUse.specifiers.some((s) => s.name === symbolName)) {
      return {
        topInsert: '',
        hint: 'symbol already imported',
      };
    }

    // Merge strategy: emit a fresh multi-line `use { ... } from '...'` at the
    // top of the file and delete the old use statement. This avoids fragile
    // in-place edits against possibly malformed specifier lists, keeps
    // formatting consistent, and tolerates syntax errors — the deleted range
    // is whatever the parser recovered as the old use.
    //
    // Every specifier is rendered as `<kind> <name>`; if the parser couldn't
    // recover a kind for an existing specifier, we fall back to the new
    // suggestion's kind as a reasonable default.
    const allSpecifiers = uniqueInOrder([
      ...existingUse.specifiers
        .filter((s) => s.name !== '*')
        .map((s) => `${s.kind ?? importKeyword} ${s.name}`),
      newSpecifier,
    ]);
    const topInsert = buildUseStatement(allSpecifiers, sourceFileStr, lineEnd);

    return {
      topInsert,
      removeRange: expandToFullLines(fileContent, existingUse.startOffset, existingUse.endOffset),
      hint: 'merged into existing',
    };
  }

  return {
    topInsert: buildUseStatement([
      newSpecifier,
    ], sourceFileStr, lineEnd),
    hint: 'created new',
  };
}

// Render a multi-line use statement with an extra trailing blank line so it
// cleanly separates from the element declaration that follows.
function buildUseStatement (specifiers: string[], sourceFileStr: string, lineEnd: string): string {
  const body = specifiers.map((s) => `  ${s}`).join(lineEnd);
  return `use {${lineEnd}${body}${lineEnd}} from '${sourceFileStr}'${lineEnd}${lineEnd}`;
}

function uniqueInOrder (xs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    const key = x.trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(x);
  }
  return out;
}

// Extend a range so it consumes any trailing newline(s), so deleting it
// removes the statement cleanly without leaving a blank line behind.
function expandToFullLines (fileContent: string, start: number, end: number): { startOffset: number; endOffset: number } {
  // Pull the start back to the beginning of the line.
  const lineStart = fileContent.lastIndexOf('\n', start - 1) + 1;
  // Eat the trailing line break so the surrounding blank line doesn't linger.
  let newEnd = end;
  while (newEnd < fileContent.length && (fileContent[newEnd] === ' ' || fileContent[newEnd] === '\t')) newEnd++;
  if (fileContent[newEnd] === '\r') newEnd++;
  if (fileContent[newEnd] === '\n') newEnd++;
  return { startOffset: lineStart, endOffset: newEnd };
}

function detectLineEnding (source: string): string {
  // Use whatever the file already uses; default to `\n`.
  return source.includes('\r\n') ? '\r\n' : '\n';
}

/**
   * Normalize a Filepath to a relative source path like './common'
   */
function normalizeSourcePath (filepath: Filepath): string {
  // Get filename without extension: /path/to/common.dbml -> common
  const basename = filepath.basename;
  const name = basename.replace(/\.dbml$/, '');

  // Return relative path: ./name
  return `./${name}`;
}
