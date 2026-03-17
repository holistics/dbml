import type Compiler from '../../index';
import type SymbolTable from '@/core/analyzer/symbol/symbolTable';

export function scopeAtOffset (this: Compiler, offset: number): Readonly<SymbolTable> | undefined {
  const element = this.elementAtOffset(offset);
  if (!element) return undefined;
  return this.nodeSymbol(element)?.symbolTable;
}
