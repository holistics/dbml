import type Compiler from '../../index';
import type { ProgramNode, SyntaxNode } from '@/core/parser/nodes';
import type { CompileError, CompileWarning } from '@/core/errors';
import type { NodeToSymbolMap, NodeToRefereeMap } from '@/core/analyzer/analyzer';
import type { Filepath, FilepathKey } from '../../projectLayout';
import Validator, { type ValidatorResult } from '@/core/analyzer/validator/validator';
import Binder from '@/core/analyzer/binder/binder';
import { NodeSymbolIdGenerator, SchemaSymbol } from '@/core/analyzer/symbol/symbols';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import Report from '@/core/report';

export type FileLocalSymbolIndex = {
  readonly path: Readonly<Filepath>;
  readonly symbolTable: Readonly<SymbolTable>;
  readonly nodeToSymbol: NodeToSymbolMap;
  readonly externalFilepaths: ReadonlyMap<FilepathKey, SyntaxNode>;
};

export function localSymbolTable (this: Compiler, filepath: Filepath): Report<FileLocalSymbolIndex> {
  const fileIndex = this.parseFile(filepath);

  if (fileIndex.errors.length > 0) {
    return new Report(
      { path: fileIndex.path, symbolTable: new SymbolTable(), nodeToSymbol: new WeakMap(), externalFilepaths: new Map() },
      [...fileIndex.errors],
      [...fileIndex.warnings],
    );
  }

  const symbolFactory = new SymbolFactory(new NodeSymbolIdGenerator());
  const nodeToSymbol: NodeToSymbolMap = new WeakMap();
  const fileSymbol = symbolFactory.create(SchemaSymbol, { symbolTable: new SymbolTable() });
  nodeToSymbol.set(fileIndex.ast, fileSymbol);

  const validationReport = new Validator({ ast: fileIndex.ast, filepath, nodeToSymbol }, symbolFactory).validate();
  const { externalFilepaths } = validationReport.getValue();

  return new Report(
    { path: fileIndex.path, symbolTable: fileSymbol.symbolTable, nodeToSymbol, externalFilepaths },
    [...fileIndex.errors, ...validationReport.getErrors()],
    [...fileIndex.warnings, ...validationReport.getWarnings()],
  );
}

export type AnalyzeResult = {
  asts: ProgramNode[];
  nodeToSymbol: NodeToSymbolMap;
  nodeToReferee: NodeToRefereeMap;
};

export function resolveProject (this: Compiler): Report<AnalyzeResult> {
  const errors: CompileError[] = [];
  const warnings: CompileWarning[] = [];

  const nodeToSymbol: NodeToSymbolMap = new WeakMap();
  const nodeToReferee: NodeToRefereeMap = new WeakMap();
  const asts: ProgramNode[] = [];

  for (const [, fileIndex] of this.parseProject()) {
    errors.push(...fileIndex.errors);
    warnings.push(...fileIndex.warnings);

    if (fileIndex.errors.length > 0) {
      continue;
    }

    const filepath = fileIndex.path as Filepath;
    const symbolFactory = new SymbolFactory(new NodeSymbolIdGenerator());
    const publicSchemaSymbol = symbolFactory.create(SchemaSymbol, { symbolTable: new SymbolTable() });
    nodeToSymbol.set(fileIndex.ast, publicSchemaSymbol);

    const validationReport = new Validator({ ast: fileIndex.ast, filepath, nodeToSymbol }, symbolFactory).validate();
    errors.push(...validationReport.getErrors());
    warnings.push(...validationReport.getWarnings());

    if (validationReport.getErrors().length > 0) {
      continue;
    }

    const { nodeToSymbol: localNodeToSymbol } = validationReport.getValue();
    const bindingReport = new Binder({ ast: fileIndex.ast, nodeToSymbol: localNodeToSymbol, nodeToReferee }, symbolFactory).resolve();
    errors.push(...bindingReport.getErrors());
    warnings.push(...bindingReport.getWarnings());

    asts.push(fileIndex.ast);
  }

  return new Report({ asts, nodeToSymbol, nodeToReferee }, errors, warnings);
}
