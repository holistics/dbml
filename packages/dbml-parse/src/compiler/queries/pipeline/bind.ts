import type Compiler from '../../index';
import Report from '@/core/types/report';
import type {
  Filepath,
} from '@/core/types/filepath';
import {
  collectTransitiveDependencies,
} from '../utils';

export function bindFile (this: Compiler, filepath: Filepath): Report<void> {
  return this.parseFile(filepath).chain(({
    ast,
  }) => this.bindNode(ast).map(() => undefined));
}

export function bindProject (this: Compiler): Map<string, Report<void>> {
  const deps = collectTransitiveDependencies(this, this.layout.getEntryPoints());

  const result = new Map<string, Report<void>>();

  for (const d of deps) {
    const bindResult = this.bindFile(d);
    result.set(d.absolute, bindResult);
  }

  return result;
}
