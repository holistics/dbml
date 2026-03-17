import type Compiler from '../../index';
import type { ProgramNode } from '@/core/parser/nodes';
import type { CompileError, CompileWarning } from '@/core/errors';
import type { NodeToSymbolMap, NodeToRefereeMap } from '@/core/analyzer/analyzer';
import Validator from '@/core/analyzer/validator/validator';
import Binder from '@/core/analyzer/binder/binder';
import { NodeSymbolIdGenerator, SchemaSymbol } from '@/core/analyzer/symbol/symbols';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import Report from '@/core/report';

export type AnalyzeResult = {
  asts: ProgramNode[];
  nodeToSymbol: NodeToSymbolMap;
  nodeToReferee: NodeToRefereeMap;
};

export function analyzeProject (this: Compiler): Report<AnalyzeResult> {
  const errors: CompileError[] = [];
  const warnings: CompileWarning[] = [];

  const symbolFactory = new SymbolFactory(new NodeSymbolIdGenerator());
  const nodeToSymbol: NodeToSymbolMap = new WeakMap();
  const nodeToReferee: NodeToRefereeMap = new WeakMap();
  const publicSchemaSymbol = symbolFactory.create(SchemaSymbol, { symbolTable: new SymbolTable() });
  const asts: ProgramNode[] = [];

  for (const [, fileIndex] of this.parseProject()) {
    errors.push(...fileIndex.errors);
    warnings.push(...fileIndex.warnings);

    if (fileIndex.errors.length > 0) {
      continue;
    }

    nodeToSymbol.set(fileIndex.ast, publicSchemaSymbol);
    const validationReport = new Validator({ ast: fileIndex.ast, nodeToSymbol }, symbolFactory).validate();
    errors.push(...validationReport.getErrors());
    warnings.push(...validationReport.getWarnings());

    if (validationReport.getErrors().length > 0) {
      continue;
    }

    const bindingReport = new Binder({ ast: fileIndex.ast, nodeToSymbol, nodeToReferee }, symbolFactory).resolve();
    errors.push(...bindingReport.getErrors());
    warnings.push(...bindingReport.getWarnings());

    asts.push(fileIndex.ast);
  }

  return new Report({ asts, nodeToSymbol, nodeToReferee }, errors, warnings);
}
