import type Compiler from '../../index';
import type { AnalysisResult } from '@/core/analyzer/analyzer';
import Report from '@/core/report';
import Analyzer from '@/core/analyzer/analyzer';
import { NodeSymbolIdGenerator } from '@/core/analyzer/symbol/symbols';

export function analyzeFile (this: Compiler): Report<Readonly<AnalysisResult>> {
  const { ast } = this.parseFile().getValue();
  return new Analyzer(ast, new NodeSymbolIdGenerator()).analyze();
}
