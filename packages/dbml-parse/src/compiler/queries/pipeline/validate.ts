import type Compiler from '../../index';
import type { SyntaxNode } from '@/core/parser/nodes';
import type { NodeToSymbolMap } from '@/core/types';
import type { CompileError, CompileWarning } from '@/core/errors';
import type { Filepath, FilepathId } from '../../projectLayout';
import Validator from '@/core/validator/validator';
import { NodeSymbolIdGenerator, SchemaSymbol } from '@/core/validator/symbol/symbols';
import SymbolFactory from '@/core/validator/symbol/factory';
import SymbolTable from '@/core/validator/symbol/symbolTable';

export type FileLocalSymbolIndex = {
  readonly path: Readonly<Filepath>;
  readonly symbolTable: Readonly<SymbolTable>;
  readonly nodeToSymbol: NodeToSymbolMap;
  readonly externalFilepaths: ReadonlyMap<FilepathId, SyntaxNode>;
  readonly errors: readonly CompileError[];
  readonly warnings: readonly CompileWarning[];
};

export function localSymbolTable (this: Compiler, filepath: Filepath): Readonly<SymbolTable> {
  return this.validateFile(filepath).symbolTable;
}

export function localFileDependencies (this: Compiler, filepath: Filepath): ReadonlyMap<FilepathId, SyntaxNode> {
  return this.validateFile(filepath).externalFilepaths;
}

export function validateFile (this: Compiler, filepath: Filepath): FileLocalSymbolIndex {
  const fileIndex = this.parseFile(filepath);

  if (fileIndex.errors.length > 0) {
    return {
      path: fileIndex.path, symbolTable: new SymbolTable(), nodeToSymbol: new WeakMap(), externalFilepaths: new Map(),
      errors: fileIndex.errors, warnings: fileIndex.warnings,
    };
  }

  const symbolFactory = new SymbolFactory(new NodeSymbolIdGenerator());
  const nodeToSymbol: NodeToSymbolMap = new WeakMap();
  const fileSymbol = symbolFactory.create(SchemaSymbol, { symbolTable: new SymbolTable() });
  nodeToSymbol.set(fileIndex.ast, fileSymbol);

  const validationReport = new Validator({ ast: fileIndex.ast, filepath, nodeToSymbol }, symbolFactory).validate();
  const { externalFilepaths } = validationReport.getValue();

  return {
    path: fileIndex.path, symbolTable: fileSymbol.symbolTable, nodeToSymbol, externalFilepaths,
    errors: [...fileIndex.errors, ...validationReport.getErrors()],
    warnings: [...fileIndex.warnings, ...validationReport.getWarnings()],
  };
}
