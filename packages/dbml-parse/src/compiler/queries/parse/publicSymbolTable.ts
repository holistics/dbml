import type Compiler from '../../index';
import type SymbolTable from '@/core/analyzer/symbol/symbolTable';

export function publicSymbolTable (this: Compiler): Readonly<SymbolTable> {
  return this.parse._().getValue().ast.symbol!.symbolTable!;
}
