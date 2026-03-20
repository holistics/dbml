import type Compiler from '../../index';
import type { CompileError, CompileWarning } from '@/core/errors';
import type { NodeToRefereeMap } from '@/core/types';
import type { Filepath } from '../../projectLayout';
import Binder from '@/core/binder/binder';
import SymbolFactory from '@/core/validator/symbol/factory';
import { NodeSymbolIdGenerator } from '@/core/validator/symbol/symbols';
import Report from '@/core/report';

export type FileBindIndex = {
  readonly nodeToReferee: NodeToRefereeMap;
};

export function bindFile (this: Compiler, filepath: Filepath): Report<FileBindIndex> {
  const local = this.localSymbolTable(filepath);

  if (local.getErrors().length > 0) {
    return new Report(
      { nodeToReferee: new WeakMap() },
      [...local.getErrors()],
      [...local.getWarnings()],
    );
  }

  const fileIndex = this.parseFile(filepath);
  const { nodeToSymbol } = local.getValue();
  const symbolFactory = new SymbolFactory(new NodeSymbolIdGenerator());
  const nodeToReferee: NodeToRefereeMap = new WeakMap();

  const bindingReport = new Binder({ ast: fileIndex.ast, nodeToSymbol, nodeToReferee }, symbolFactory).resolve();

  return new Report(
    { nodeToReferee },
    [...local.getErrors(), ...bindingReport.getErrors()],
    [...local.getWarnings(), ...bindingReport.getWarnings()],
  );
}

export function bindProject (this: Compiler): Report<void> {
  const errors: CompileError[] = [];
  const warnings: CompileWarning[] = [];

  for (const [, fileIndex] of this.parseProject()) {
    const result = this.bindFile(fileIndex.path as Filepath);
    errors.push(...result.getErrors());
    warnings.push(...result.getWarnings());
  }

  return new Report(undefined, errors, warnings);
}
