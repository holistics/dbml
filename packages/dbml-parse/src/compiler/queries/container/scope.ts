import type SymbolTable from '@/core/types/symbol/symbolTable';
import type Compiler from '../../index';

export function containerScope (this: Compiler, offset: number): Readonly<SymbolTable> | undefined {
  return this.container.element(offset)?.symbol?.symbolTable;
}
