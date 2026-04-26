import Analyzer from '@/core/analyzer/analyzer';
import Interpreter from '@/core/interpreter/interpreter';
import type {
  Filepath,
} from '@/core/types/filepath';
import type {
  Database,
} from '@/core/types/schemaJson';
import Report from '@/core/types/report';
import type Compiler from '../../index';

export function interpretFile (this: Compiler, filepath: Filepath): Report<Readonly<Database> | undefined> {
  return this.parseFile(filepath).chain(({ ast }) => {
    const analyzeResult = new Analyzer(ast, this.symbolIdGenerator).analyze();
    if (analyzeResult.getErrors().length > 0) {
      return analyzeResult.map(() => undefined);
    }
    return analyzeResult.chain(() => new Interpreter(ast).interpret());
  });
}
