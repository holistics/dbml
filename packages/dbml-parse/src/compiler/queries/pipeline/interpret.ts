import type Compiler from '../../index';
import type { Database } from '@/core/interpreter/types';
import Interpreter from '@/core/interpreter/interpreter';
import Report from '@/core/report';

function mergeDatabases (dbs: Database[]): Database {
  return {
    schemas: [],
    tables: dbs.flatMap((d) => d.tables),
    notes: dbs.flatMap((d) => d.notes),
    refs: dbs.flatMap((d) => d.refs),
    enums: dbs.flatMap((d) => d.enums),
    tableGroups: dbs.flatMap((d) => d.tableGroups),
    aliases: dbs.flatMap((d) => d.aliases),
    project: dbs.find((d) => Object.keys(d.project).length > 0)?.project ?? {},
    tablePartials: dbs.flatMap((d) => d.tablePartials),
    records: dbs.flatMap((d) => d.records),
  };
}

export function interpretProject (this: Compiler): Report<Database | undefined> {
  const analyzeReport = this.resolveProject();
  const { asts, nodeToSymbol, nodeToReferee } = analyzeReport.getValue();

  const databases: Database[] = [];
  let report: Report<unknown> = analyzeReport.map(() => undefined);

  for (const ast of asts) {
    const interpretReport = new Interpreter({ ast, nodeToSymbol, nodeToReferee }).interpret();
    databases.push(interpretReport.getValue());
    report = report.chain(() => interpretReport.map(() => undefined));
  }

  const database = databases.length > 0 ? mergeDatabases(databases) : undefined;

  return report.map(() => database);
}

