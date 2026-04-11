import type Compiler from '@/compiler';
import { Filepath } from '@/core/types/filepath';
import { UseDeclarationNode, UseSpecifierListNode, WildcardNode, VariableNode, SyntaxNodeKind } from '@/core/types/nodes';

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

export class UseStatementMerger {
  /**
   * Scan existing use statements in file using compiler AST.
   * This is precise and avoids regex false positives (e.g., in comments).
   */
  static scanExistingUses (
    compiler: Compiler,
    filepath: Filepath,
    fileContent: string,
  ): ParsedUseStatement[] {
    const results: ParsedUseStatement[] = [];

    // Parse the file to get the AST
    const parseResult = compiler.parseFile(filepath);
    if (parseResult.getErrors().length > 0) {
      // If parse fails, return empty (no use statements found)
      return results;
    }

    const ast = parseResult.getValue().ast;

    // Extract use statements from the program node
    for (const useNode of ast.uses) {
      const sourceFile = useNode.importPath?.value ?? '';
      const importedSymbols: string[] = [];

      // Extract symbols from specifiers
      if (useNode.specifiers instanceof UseSpecifierListNode) {
        // Selective import: use { symbol1, symbol2 } from './path'
        for (const specifier of useNode.specifiers.specifiers) {
          let name: string | null = null;

          if (specifier.name) {
            // Try to get the symbol name from the AST node
            name = this.extractSymbolName(specifier.name);
          }

          // Fallback: extract from source text using node positions
          if (!name && specifier.name && specifier.name.start !== undefined && specifier.name.end !== undefined) {
            name = fileContent.slice(specifier.name.start, specifier.name.end).trim();
          }

          if (name) {
            importedSymbols.push(name);
          }
        }
      } else if (useNode.specifiers instanceof WildcardNode) {
        // Wildcard import: use * from './path'
        // For wildcard, we don't enumerate symbols here
        // Mark as wildcard by using special value
        importedSymbols.push('*');
      }

      // Skip use statements that didn't extract any symbols (likely parse errors or incomplete statements)
      if (importedSymbols.length === 0 && !(useNode.specifiers instanceof WildcardNode)) {
        continue;
      }

      results.push({
        startOffset: useNode.fullStart,
        endOffset: useNode.fullEnd,
        sourceFile,
        importedSymbols,
        node: useNode,
      });
    }

    return results;
  }

  /**
   * Extract symbol name from an expression node.
   * Handles simple identifiers (VariableNode) and qualified names.
   */
  private static extractSymbolName (node: any): string | null {
    if (!node) return null;

    // Handle VariableNode: has a 'variable' token property
    if (node instanceof VariableNode && node.variable) {
      return node.variable.value ?? null;
    }

    // Handle nodes with direct 'variable' property
    if (node.variable && typeof node.variable.value === 'string') {
      return node.variable.value;
    }

    // Handle nodes with 'value' property (for tokens)
    if (typeof node.value === 'string') {
      return node.value;
    }

    // Handle nodes with 'name' property
    if (typeof node.name === 'string') {
      return node.name;
    }

    // Fallback: try to extract from source text
    if (node.source && typeof node.start === 'number' && typeof node.end === 'number') {
      const text = node.source.slice(node.start, node.end);
      return text.trim() || null;
    }

    return null;
  }

  /**
   * Merge a new symbol into the file's use statements.
   * If a use from sourceFile exists, add the symbol to it.
   * If not, create a new use statement at the top.
   */
  static mergeSymbolIntoUses (
    compiler: Compiler,
    filepath: Filepath,
    fileContent: string,
    symbolName: string,
    sourceFile: Filepath,
  ): UseStatementMergeResult {
    const existingUses = this.scanExistingUses(compiler, filepath, fileContent);

    // Normalize source file path: '/path/to/common' → './common'
    const sourceFileStr = this.normalizeSourcePath(sourceFile);

    // Look for existing use from this source file
    const existingUseIndex = existingUses.findIndex(u => u.sourceFile === sourceFileStr);

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
      const beforeClosingBrace = useStatement.slice(0, closingBraceIdx).trimRight();

      const newUseStatement = `${beforeClosingBrace}, ${symbolName} }${useStatement.slice(closingBraceIdx + 1)}`;
      const newContent = beforeUse + newUseStatement + afterUse;

      return {
        newContent,
        editStartOffset: existingUse.startOffset,
        editEndOffset: existingUse.endOffset + (newUseStatement.length - useStatement.length),
        hint: 'merged into existing',
      };
    } else {
      // Create new use statement at top of file
      const newUseStatement = `use { ${symbolName} } from '${sourceFileStr}'\n`;
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
  private static normalizeSourcePath (filepath: Filepath): string {
    const abs = filepath.absolute;

    // Get filename without extension: /path/to/common.dbml → common
    const basename = filepath.basename;
    const name = basename.replace(/\.dbml$/, '');

    // Return relative path: ./name
    return `./${name}`;
  }
}
