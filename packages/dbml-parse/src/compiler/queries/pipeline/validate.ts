import type Compiler from '../../index';
import { Filepath } from '../../projectLayout';
import { NodeToSymbolMap } from '@/core/binder/analyzer';
import { InternedMap } from '@/core/internable';
import Validator from '@/core/binder/validator/validator';
import SymbolFactory from '@/core/binder/symbol/factory';
import { SchemaSymbol } from '@/core/binder/symbol/symbols';
import SymbolTable from '@/core/binder/symbol/symbolTable';
import Report from '@/core/report';

export function validateFile (this: Compiler, filepath: Filepath): Report<{ symbolTable: SymbolTable; nodeToSymbol: NodeToSymbolMap }> {
  const nodeToSymbol: NodeToSymbolMap = new InternedMap();
  return this.parseFile(filepath).chain(({ ast }) => {
    const symbolFactory = new SymbolFactory(this.symbolIdGenerator, filepath);
    return new Validator({ ast }, { nodeToSymbol }, symbolFactory).validate().map(({ nodeToSymbol: ntm }) => {
      const rootSymbol = ntm.get(ast) as SchemaSymbol;
      return { symbolTable: rootSymbol.symbolTable, nodeToSymbol: ntm };
    });
  });
}
