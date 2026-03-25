import type Compiler from '../../index';
import type { NodeToSymbolMap } from '@/core/analyzer/analyzer';
import Report from '@/core/report';
import Analyzer from '@/core/analyzer/analyzer';
import { NodeSymbolIdGenerator } from '@/core/analyzer/symbol/symbols';

export function validateFile (this: Compiler): Report<{ nodeToSymbol: NodeToSymbolMap }> {
  const { ast } = this.parseFile().getValue();
  return new Analyzer(ast, new NodeSymbolIdGenerator()).validate().map((nodeToSymbol) => ({ nodeToSymbol }));
}
