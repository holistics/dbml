import type Compiler from '@/compiler';
import {
  SymbolKind,
} from '@/core/types';
import {
  Filepath,
} from '@/core/types/filepath';
import {
  UseDeclarationNode, UseSpecifierListNode, WildcardNode,
} from '@/core/types/nodes';
import {
  extractVariableFromExpression,
} from '@/core/utils/expression';

export interface ParsedUseSpecifier {
  kind?: string;
  name: string; // FIXME: bare symbol name, or '*' for wildcard
}

export interface ParsedUseStatement {
  startOffset: number;
  endOffset: number;
  sourceFile: string; // e.g., './common'
  specifiers: ParsedUseSpecifier[];
  node: UseDeclarationNode; // Original AST node for precise source tracking
}

export interface UseStatementMergeResult {
  topInsert: string;
  removeRange?: {
    startOffset: number;
    endOffset: number;
  };
  hint?: string; // 'merged into existing' | 'created new' | 'symbol already imported'
}

export function scanExistingUses (
  compiler: Compiler,
  filepath: Filepath,
  fileContent: string,
): ParsedUseStatement[] {
  const results: ParsedUseStatement[] = [];

  const parseResult = compiler.parseFile(filepath);
  const ast = parseResult.getValue()?.ast;
  if (!ast) return results;

  for (const useNode of ast.uses) {
    let sourceFile = useNode.importPath?.value ?? '';
    if (!sourceFile) {
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
        'table',
        'enum',
        'tablepartial',
        'tablegroup',
        'note',
        'schema',
        'from',
      ]);
      for (const specifier of useNode.specifiers.specifiers) {
        let kind: string | undefined;
        let name: string | undefined;

        if (specifier.name) {
          // Fully formed: `use { table users }`
          kind = specifier.importKind?.value;
          name = extractVariableFromExpression(specifier.name);
          if (!name && specifier.name.start !== undefined && specifier.name.end !== undefined) {
            name = fileContent.slice(specifier.name.start, specifier.name.end).trim();
          }
        } else if (specifier.importKind) {
          // Parse recovery: `use { User }`  -- "kind slot" holds the symbol name.
          const val = specifier.importKind.value ?? undefined;
          if (val && !IMPORT_KIND_KEYWORDS.has(val.toLowerCase())) {
            name = val;
          }
        }

        if (name && name.toLowerCase() !== 'from') {
          specifiers.push({
            kind,
            name,
          });
        }
      }
    } else if (useNode.specifiers instanceof WildcardNode) {
      specifiers.push({
        name: '*',
      });
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
/** Merge a new symbol into the file's use statements.
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

  // Normalize source file path: '/path/to/common' -> './common'
  const sourceFileStr = normalizeSourcePath(sourceFile);

  // Look for existing use from this source file
  const existingUseIndex = existingUses.findIndex((u) => u.sourceFile === sourceFileStr);

  const newSpecifier = `${symbolKind} ${symbolName}`;
  const lineEnd = detectLineEnding(fileContent);

  if (existingUseIndex !== -1) {
    const existingUse = existingUses[existingUseIndex];

    // Duplicate - nothing to do. Surface no edit.
    if (existingUse.specifiers.some((s) => s.name === symbolName)) {
      return {
        topInsert: '',
        hint: 'symbol already imported',
      };
    }

    const allSpecifiers = uniqueInOrder([
      ...existingUse.specifiers
        .filter((s) => s.name !== '*')
        .map((s) => `${s.kind ?? symbolKind} ${s.name}`),
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
function expandToFullLines (fileContent: string, start: number, end: number): { startOffset: number;
  endOffset: number; } {
  // Pull the start back to the beginning of the line.
  const lineStart = fileContent.lastIndexOf('\n', start - 1) + 1;
  // Eat the trailing line break so the surrounding blank line doesn't linger.
  let newEnd = end;
  while (newEnd < fileContent.length && (fileContent[newEnd] === ' ' || fileContent[newEnd] === '\t')) newEnd++;
  if (newEnd < fileContent.length && fileContent[newEnd] === '\r') newEnd++;
  if (newEnd < fileContent.length && fileContent[newEnd] === '\n') newEnd++;
  return {
    startOffset: lineStart,
    endOffset: newEnd,
  };
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
