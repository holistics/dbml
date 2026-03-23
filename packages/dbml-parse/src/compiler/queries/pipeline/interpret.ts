import type Compiler from '../../index';
import type { Filepath } from '../../projectLayout';
import type { Database } from '@/core/interpreter/types';
import Interpreter from '@/core/interpreter/interpreter';
import Report from '@/core/report';

export function interpretFile (this: Compiler, filepath: Filepath): Report<Database> {
  const fileIndex = this.parseFile(filepath);
  const bound = this.bindFile(filepath);

  const errors = [...bound.getErrors()];
  const warnings = [...bound.getWarnings()];

  if (errors.length > 0) {
    return new Report(emptyDatabase(), errors, warnings);
  }

  const { nodeToSymbol, nodeToReferee, symbolToReferences } = bound.getValue();
  const interpretReport = new Interpreter({ ast: fileIndex.ast, nodeToSymbol, nodeToReferee, symbolToReferences }).interpret();

  return new Report(
    interpretReport.getValue(),
    [...errors, ...interpretReport.getErrors()],
    [...warnings, ...interpretReport.getWarnings()],
  );
}

function emptyDatabase (): Database {
  return { schemas: [], tables: [], notes: [], refs: [], enums: [], tableGroups: [], aliases: [], project: {}, tablePartials: [], records: [] };
}
