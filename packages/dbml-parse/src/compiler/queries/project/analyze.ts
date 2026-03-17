import type Compiler from '../../index';
import type { ProgramNode } from '@/core/parser/nodes';
import type { CompileError, CompileWarning } from '@/core/errors';
import type { AnalysisResult } from '@/core/analyzer/analyzer';
import Analyzer from '@/core/analyzer/analyzer';
import { NodeSymbolIdGenerator } from '@/core/analyzer/symbol/symbols';
import type { FilepathKey } from '../../projectLayout';

export function analyzeProject (this: Compiler): Map<FilepathKey, { ast: ProgramNode; errors: readonly CompileError[]; warnings: readonly CompileWarning[]; analysisResult: AnalysisResult }> {
  const result = new Map<FilepathKey, { ast: ProgramNode; errors: readonly CompileError[]; warnings: readonly CompileWarning[]; analysisResult: AnalysisResult }>();

  for (const [key, fileIndex] of this.parseProject()) {
    if (fileIndex.errors.length > 0) {
      continue;
    }

    const symbolIdGenerator = new NodeSymbolIdGenerator();
    const analysisReport = new Analyzer(fileIndex.ast, symbolIdGenerator).analyze();

    result.set(key, {
      ast: fileIndex.ast,
      errors: analysisReport.getErrors(),
      warnings: [...fileIndex.warnings, ...analysisReport.getWarnings()],
      analysisResult: analysisReport.getValue(),
    });
  }

  return result;
}
