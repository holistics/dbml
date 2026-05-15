import type { Filepath } from '@/core/types/filepath';
import Report from '@/core/types/report';
import type Compiler from '../../index';

export function validateFile (this: Compiler, filepath: Filepath): Report<void> {
  return this.parseFile(filepath).chain(({
    ast,
  }) => this.validateNode(ast).map(() => undefined));
}
