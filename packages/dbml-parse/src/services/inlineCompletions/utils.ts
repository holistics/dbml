import { ColumnSymbol, TablePartialInjectedColumnSymbol } from '@/core/analyzer/symbol/symbols';
import { extractVariableFromExpression } from '@/core/analyzer/utils';
import { FunctionApplicationNode } from '@/core/parser/nodes';
import { createColumnSymbolIndex } from '@/core/analyzer/symbol/symbolIndex';

export function extractColumnNameAndType (
  columnSymbol: ColumnSymbol | TablePartialInjectedColumnSymbol,
  columnName?: string,
): { name: string; type: string } | null {
  // Handle table partial injected columns
  if (columnSymbol instanceof TablePartialInjectedColumnSymbol) {
    console.log('[DEBUG extractColumnNameAndType] Injected column:', columnName);
    const tablePartialSymbol = columnSymbol.tablePartialSymbol;
    console.log('[DEBUG extractColumnNameAndType] tablePartialSymbol:', !!tablePartialSymbol);
    console.log('[DEBUG extractColumnNameAndType] symbolTable:', !!tablePartialSymbol?.symbolTable);
    if (!tablePartialSymbol?.symbolTable || !columnName) {
      console.log('[DEBUG extractColumnNameAndType] Returning null - no symbol table or columnName');
      return null;
    }

    // Look up the column in the table partial's symbol table
    const columnIndex = createColumnSymbolIndex(columnName);
    const actualColumnSymbol = tablePartialSymbol.symbolTable.get(columnIndex);
    console.log('[DEBUG extractColumnNameAndType] actualColumnSymbol:', !!actualColumnSymbol);
    console.log('[DEBUG extractColumnNameAndType] declaration:', actualColumnSymbol?.declaration?.constructor.name);
    if (!actualColumnSymbol?.declaration || !(actualColumnSymbol.declaration instanceof FunctionApplicationNode)) {
      console.log('[DEBUG extractColumnNameAndType] Returning null - no declaration or not FunctionApplicationNode');
      return null;
    }

    // Extract type from the actual column declaration
    const type = extractVariableFromExpression(actualColumnSymbol.declaration.args[0]).unwrap_or(null);
    console.log('[DEBUG extractColumnNameAndType] type:', type);
    if (!type) {
      console.log('[DEBUG extractColumnNameAndType] Returning null - no type');
      return null;
    }

    return { name: columnName, type };
  }

  // Handle regular column symbols
  if (!(columnSymbol?.declaration instanceof FunctionApplicationNode)) {
    return null;
  }
  const declaration = columnSymbol.declaration as FunctionApplicationNode;
  const name = extractVariableFromExpression(declaration.callee).unwrap_or(null);
  const type = extractVariableFromExpression(declaration.args[0]).unwrap_or(null);

  if (!name || !type) {
    return null;
  }

  return { name, type };
}
