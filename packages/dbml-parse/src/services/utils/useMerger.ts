import type Compiler from '@/compiler';
import { SymbolKind } from '@/core/types';
import {
  Filepath,
} from '@/core/types/filepath';
import {
  UseDeclarationNode, UseSpecifierListNode, VariableNode, WildcardNode,
} from '@/core/types/nodes';

export interface ParsedUseStatement {
  startOffset: number;
  endOffset: number;
  sourceFile: string; // e.g., './common'
  importedSymbols: string[];
  node: UseDeclarationNode; // Original AST node for precise source tracking
}

export interface UseStatementMergeResult {
  newContent: string;
  editStartOffset: number;
  editEndOffset: number;
  hint?: string; // 'merged into existing' or 'created new'
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
    const importedSymbols: string[] = [];

    // Extract symbols from specifiers
    if (useNode.specifiers instanceof UseSpecifierListNode) {
      // Selective import: use { [kind] symbol1, [kind] symbol2 } from './path'
      for (const specifier of useNode.specifiers.specifiers) {
        let name: string | undefined = undefined;

        if (specifier.name) {
          // Fully formed specifier: has both importKind and name
          name = extractSymbolName(specifier.name);
          // Fallback: extract from source text using node positions
          if (!name && specifier.name.start !== undefined && specifier.name.end !== undefined) {
            name = fileContent.slice(specifier.name.start, specifier.name.end).trim();
          }
        } else if (specifier.importKind) {
          // No explicit kind token — the "kind slot" holds the symbol name (e.g. `use { User }`)
          // Reject DBML import-kind keywords that leaked in due to parser error recovery.
          const IMPORT_KIND_KEYWORDS = new Set([
            'table',
            'enum',
            'tablepartial',
            'tablegroup',
            'note',
            'from',
          ]);
          const val = specifier.importKind.value ?? undefined;
          if (val && !IMPORT_KIND_KEYWORDS.has(val.toLowerCase())) {
            name = val;
          }
        }

        // Filter out DBML keywords that can leak in as symbol names due to error recovery
        if (name && name.toLowerCase() !== 'from') {
          importedSymbols.push(name);
        }
      }
    } else if (useNode.specifiers instanceof WildcardNode) {
      // Wildcard import: use * from './path'
      importedSymbols.push('*');
    }

    // Skip use statements without extractable symbols
    if (importedSymbols.length === 0 && !(useNode.specifiers instanceof WildcardNode)) {
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
      importedSymbols,
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

  if (existingUseIndex !== -1) {
    // Merge into existing use statement
    const existingUse = existingUses[existingUseIndex];

    // Check for duplicates
    if (existingUse.importedSymbols.includes(symbolName)) {
      // Already imported, no change needed
      return {
        newContent: fileContent,
        editStartOffset: existingUse.startOffset,
        editEndOffset: existingUse.endOffset,
        hint: 'symbol already imported',
      };
    }

    // Add symbol to existing import list
    const beforeUse = fileContent.slice(0, existingUse.startOffset);
    const afterUse = fileContent.slice(existingUse.endOffset);

    // Find the closing brace of the import list
    const useStatement = fileContent.slice(existingUse.startOffset, existingUse.endOffset);
    const closingBraceIdx = useStatement.lastIndexOf('}');
    const beforeClosingBrace = useStatement.slice(0, closingBraceIdx).trimEnd();

    const newUseStatement = `${beforeClosingBrace}
${symbolName}
}${useStatement.slice(closingBraceIdx + 1)}`;
    const newContent = beforeUse + newUseStatement + afterUse;

    return {
      newContent,
      editStartOffset: existingUse.startOffset,
      editEndOffset: existingUse.endOffset + (newUseStatement.length - useStatement.length),
      hint: 'merged into existing',
    };
  } else {
    // Create new use statement at top of file
    const newUseStatement = `use { ${symbolKind} ${symbolName} } from '${sourceFileStr}'\n`;
    const newContent = newUseStatement + fileContent;

    return {
      newContent,
      editStartOffset: 0,
      editEndOffset: newUseStatement.length,
      hint: 'created new',
    };
  }
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
