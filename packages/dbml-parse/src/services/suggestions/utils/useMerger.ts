// This file contains functions for merging use statements for auto-import
// e.g
// ```
// use { table T } from './path'
// ```
// If we auto import table R from './path'
// Then `use { table R } from './path'` should be merged into use T.
// Result:
// ```
// use {
//   table T
//   table R
// } from './path'
// ```

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

// A single use specifier information
// e.g. `use { table user as u } from './path'`
//             ^^^^^ ^^^^    ^
//             kind  name   alias
export interface ParsedUseSpecifier {
  kind?: string;
  name: string;
  alias?: string;
}

// A single use statement information
// e.g. `use { table user as u } from './path'`
export interface ParsedUseStatement {
  startOffset: number;
  endOffset: number;
  sourceFile: string; // e.g., './common'
  specifiers: ParsedUseSpecifier[];
  node: UseDeclarationNode; // Original AST node for precise source tracking
}

// Instructions to merge use statements
export interface UseStatementMergeResult {
  topInsert: string; // The "merged" use statement to insert at the top
  // Remove the old, non-merged use statement
  removeRange?: {
    startOffset: number;
    endOffset: number;
  };
}

export function scanExistingUses (
  compiler: Compiler,
  filepath: Filepath,
): ParsedUseStatement[] {
  const results: ParsedUseStatement[] = [];

  const parseResult = compiler.parseFile(filepath);
  const ast = parseResult.getValue()?.ast;
  if (!ast) return results;

  for (const useNode of ast.uses) {
    const sourceFile = useNode.importPath?.value ?? '';
    const specifiers: ParsedUseSpecifier[] = [];

    if (useNode.specifiers instanceof UseSpecifierListNode) {
      for (const specifier of useNode.specifiers.specifiers) {
        let kind: string | undefined;
        let name: string | undefined;

        if (specifier.name) {
          kind = specifier.importKind?.value;
          name = extractVariableFromExpression(specifier.name);
        } else if (specifier.importKind) {
          // Parse recovery: `use { User }` - "kind slot" holds the symbol name.
          name = specifier.importKind.value ?? undefined;
        }

        if (name) {
          const alias = specifier.alias ? extractVariableFromExpression(specifier.alias) : undefined;
          specifiers.push({ kind, name, alias });
        }
      }
    } else if (useNode.specifiers instanceof WildcardNode) {
      specifiers.push({ name: '*' });
    }

    if (specifiers.length === 0 && !(useNode.specifiers instanceof WildcardNode)) {
      continue;
    }

    results.push({
      startOffset: useNode.fullStart,
      endOffset: useNode.fullEnd,
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
  symbolName: string,
  symbolKind: SymbolKind,
  sourceFilepath: Filepath,
  currentFilepath: Filepath,
  fileContent: string,
): UseStatementMergeResult {
  const existingUses = scanExistingUses(compiler, currentFilepath);

  // Normalize source file path relative to the current file's directory
  const sourceFileStr = normalizeSourcePath(sourceFilepath, currentFilepath);

  // Look for existing use from this source file
  const existingUseIndex = existingUses.findIndex((u) => u.sourceFile === sourceFileStr);

  const newSpecifier = `${symbolKind} ${symbolName}`;
  const lineEnd = '\n';

  if (existingUseIndex !== -1) {
    const existingUse = existingUses[existingUseIndex];

    // Duplicate - nothing to do. Surface no edit.
    if (existingUse.specifiers.some((s) => s.name === symbolName)) {
      return {
        topInsert: '',
      };
    }

    const allSpecifiers = uniqueInOrder([
      ...existingUse.specifiers
        .filter((s) => s.name !== '*')
        .map((s) => `${s.kind ?? symbolKind} ${s.name}${s.alias ? ` as ${s.alias}` : ''}`),
      newSpecifier,
    ]);
    const topInsert = buildUseStatement(allSpecifiers, sourceFileStr, lineEnd);

    return {
      topInsert,
      removeRange: expandToFullLines(fileContent, existingUse.startOffset, existingUse.endOffset),
    };
  }

  return {
    topInsert: buildUseStatement([
      newSpecifier,
    ], sourceFileStr, lineEnd),
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

/**
  * Normalize a source Filepath to a relative path as seen from the current file's directory,
  * with the .dbml extension stripped.
  * e.g. source=/a/b/common.dbml, current=/a/c/main.dbml -> '../b/common'
  */
function normalizeSourcePath (filepath: Filepath, currentFilepath: Filepath): string {
  return filepath.relativeTo(currentFilepath.dirname).replace(/\.dbml$/, '');
}
