import type Compiler from '../../index';
import type SymbolTable from '@/core/analyzer/symbol/symbolTable';

export function containerScope (this: Compiler, offset: number): Readonly<SymbolTable> | undefined {
  return this.container.element(offset)?.symbol?.symbolTable;
}
