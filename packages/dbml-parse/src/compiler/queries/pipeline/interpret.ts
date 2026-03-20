import type Compiler from '../../index';
import type { Filepath } from '../../projectLayout';
import type { Database } from '@/core/interpreter/types';
import Interpreter from '@/core/interpreter/interpreter';
import Report from '@/core/report';

export function interpretFile (this: Compiler, filepath: Filepath): Report<Database> {
  const fileIndex = this.parseFile(filepath);
  const local = this.validateFile(filepath);
  const bound = this.bindFile(filepath);

  const allErrors = [...local.errors, ...bound.getErrors()];
  const allWarnings = [...local.warnings, ...bound.getWarnings()];

  if (allErrors.length > 0) {
    return new Report(emptyDatabase(), allErrors, allWarnings);
  }

  const { nodeToSymbol } = local;
  const { nodeToReferee, symbolToReferences } = bound.getValue();
  const interpretReport = new Interpreter({ ast: fileIndex.ast, nodeToSymbol, nodeToReferee, symbolToReferences }).interpret();

  return new Report(
    interpretReport.getValue(),
    [...allErrors, ...interpretReport.getErrors()],
    [...allWarnings, ...interpretReport.getWarnings()],
  );
}

function emptyDatabase (): Database {
  return { schemas: [], tables: [], notes: [], refs: [], enums: [], tableGroups: [], aliases: [], project: {}, tablePartials: [], records: [] };
}
