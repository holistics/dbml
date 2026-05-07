import {
  type Filepath,
} from '@/core/types/filepath';
import type SymbolTable from '@/core/types/symbol/symbolTable';
import type Compiler from '../../index';

export function containerScope (this: Compiler, filepath: Filepath, offset: number): Readonly<SymbolTable> | undefined {
  return this.container.element(filepath, offset)?.symbol?.symbolTable;
}
