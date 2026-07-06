import type { Filepath } from '@/core/types/filepath';
import Report from '@/core/types/report';
import type Compiler from '../../index';
import { collectTransitiveDependencies } from '../utils';

export function bindFile (this: Compiler, filepath: Filepath): Report<void> {
  const validateResult = this.validateFile(filepath);
  const ast = this.parseFile(filepath).getValue().ast;
  const bindResult = this.bindNode(ast).map(() => undefined);
  return new Report(
    undefined,
    [
      ...validateResult.getErrors(),
      ...bindResult.getErrors(),
    ],
    [
      ...validateResult.getWarnings(),
      ...bindResult.getWarnings(),
    ],
  );
}

export function bindProject (this: Compiler): Map<string, Report<void>> {
  const deps = collectTransitiveDependencies(this, this.layout.getEntrypoints());

  const result = new Map<string, Report<void>>();

  for (const d of deps) {
    const bindResult = this.bindFile(d);
    result.set(d.absolute, bindResult);
  }

  return result;
}
