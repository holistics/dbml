import type Compiler from '../../index';
import { Filepath } from '../../projectLayout';
import { NodeToSymbolMap } from '@/core/binder/analyzer';
import { InternedMap } from '@/core/internable';
import Validator from '@/core/binder/validator/validator';
import SymbolFactory from '@/core/binder/symbol/factory';
import { SchemaSymbol } from '@/core/binder/symbol/symbols';
import Report from '@/core/report';

export type FileValidateIndex = {
  readonly publicSchemaSymbol: SchemaSymbol;
};

export function validateFile (this: Compiler, filepath: Filepath): Report<FileValidateIndex> {
  const nodeToSymbol: NodeToSymbolMap = new InternedMap();
  return this.parseFile(filepath).chain(({ ast }) => {
    const symbolFactory = new SymbolFactory(this.symbolIdGenerator, filepath);
    return new Validator({ ast }, { nodeToSymbol }, symbolFactory).validate().map(() => {
      const publicSchemaSymbol = nodeToSymbol.get(ast) as SchemaSymbol;
      return { publicSchemaSymbol };
    });
  });
}
