import type Compiler from '../../index';
import type { Filepath } from '../../projectLayout';
import type SymbolTable from '@/core/validator/symbol/symbolTable';

export function containerScope (this: Compiler, offset: number, filepath: Filepath): Readonly<SymbolTable> | undefined {
  const element = this.container.element(offset, filepath);
  if (!element) return undefined;
  return this.symbol.nodeSymbol(element, filepath)?.symbolTable;
}
