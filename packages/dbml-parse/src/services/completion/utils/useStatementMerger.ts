import { Filepath } from '@/core/types/filepath';

export interface ParsedUseStatement {
  startOffset: number;
  endOffset: number;
  sourceFile: string; // e.g., './common'
  importedSymbols: string[];
}

export interface UseStatementMergeResult {
  newContent: string;
  editStartOffset: number;
  editEndOffset: number;
  hint?: string; // 'merged into existing' or 'created new'
}

export class UseStatementMerger {
  /**
   * Scan existing use statements in file content.
   * Returns array of parsed use declarations.
   */
  static scanExistingUses (fileContent: string): ParsedUseStatement[] {
    const results: ParsedUseStatement[] = [];
    // Match: use { symbol1, symbol2 } from './path'
    // or: use { symbol } from "./path"
    const pattern = /use\s*\{\s*([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(fileContent)) !== null) {
      const symbolsStr = match[1];
      const sourceFile = match[2];
      const startOffset = match.index;
      const endOffset = match.index + match[0].length;

      // Parse symbols: split by comma, trim whitespace
      const importedSymbols = symbolsStr
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      results.push({
        startOffset,
        endOffset,
        sourceFile,
        importedSymbols,
      });
    }

    return results;
  }

  /**
   * Merge a new symbol into the file's use statements.
   * If a use from sourceFile exists, add the symbol to it.
   * If not, create a new use statement at the top.
   */
  static mergeSymbolIntoUses (
    fileContent: string,
    symbolName: string,
    sourceFile: Filepath,
  ): UseStatementMergeResult {
    const existingUses = this.scanExistingUses(fileContent);

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
