import type Compiler from '../../index';
import type { Database } from '@/core/interpreter/types';
import Report from '@/core/report';
import Interpreter from '@/core/interpreter/interpreter';

export function interpretFile (this: Compiler): Report<Database | undefined> {
  const pipeline = this.parseFile()
    .chain(() => this.analyzeFile());

  if (pipeline.getErrors().length > 0) {
    return pipeline.map(() => undefined);
  }

  return pipeline.chain(() => new Interpreter(this).interpret());
}
