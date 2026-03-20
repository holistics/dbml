import type Compiler from '../../index';
import type { SyntaxNode } from '@/core/parser/nodes';
import type { NodeToSymbolMap } from '@/core/types';
import type { Filepath, FilepathKey } from '../../projectLayout';
import Validator from '@/core/validator/validator';
import { NodeSymbolIdGenerator, SchemaSymbol } from '@/core/validator/symbol/symbols';
import SymbolFactory from '@/core/validator/symbol/factory';
import SymbolTable from '@/core/validator/symbol/symbolTable';
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
