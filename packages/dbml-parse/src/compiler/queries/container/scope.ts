import type Compiler from '../../index';
import type SymbolTable from '@/core/validator/symbol/symbolTable';

export function containerScope (this: Compiler, offset: number): Readonly<SymbolTable> | undefined {
  const element = this.container.element(offset);
  if (!element) return undefined;
  return this.symbol.nodeSymbol(element)?.symbolTable;
}
