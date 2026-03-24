import type Compiler from '../../index';
import type { SyntaxNode, UseDeclarationNode } from '@/core/parser/nodes';
import type { NodeToSymbolMap } from '@/core/types';
import type { CompileError, CompileWarning } from '@/core/errors';
import type { Filepath, FilepathId } from '../../projectLayout';
import Validator from '@/core/validator/validator';
import { NodeSymbolIdGenerator, SchemaSymbol } from '@/core/validator/symbol/symbols';
import SymbolFactory from '@/core/validator/symbol/factory';
import SymbolTable from '@/core/validator/symbol/symbolTable';

// WARNING: symbolTable contains unresolved ExternalSymbols.
// Most consumers should use bindFile instead.
export type FileLocalSymbolIndex = {
  readonly path: Readonly<Filepath>;
  readonly symbolTable: Readonly<SymbolTable>;
  readonly symbolIdGenerator: NodeSymbolIdGenerator;
  readonly nodeToSymbol: NodeToSymbolMap;
  readonly externalFilepaths: ReadonlyMap<FilepathId, UseDeclarationNode>;
  readonly errors: readonly CompileError[];
  readonly warnings: readonly CompileWarning[];
};

export function localSymbolTable (this: Compiler, filepath: Filepath): Readonly<SymbolTable> {
  return this.validateFile(filepath).symbolTable;
}

export function localFileDependencies (this: Compiler, filepath: Filepath): ReadonlyMap<FilepathId, UseDeclarationNode> {
  return this.validateFile(filepath).externalFilepaths;
}

export function validateFile (this: Compiler, filepath: Filepath): FileLocalSymbolIndex {
  const fileIndex = this.parseFile(filepath);
  const symbolIdGenerator = new NodeSymbolIdGenerator();
  const symbolFactory = new SymbolFactory(symbolIdGenerator, filepath);
  const nodeToSymbol: NodeToSymbolMap = new Map();
  const fileSymbol = symbolFactory.create(SchemaSymbol, { symbolTable: new SymbolTable() });
  nodeToSymbol.set(fileIndex.ast, fileSymbol);

  const validationReport = new Validator({ ast: fileIndex.ast, filepath, nodeToSymbol }, symbolFactory).validate();
  const { externalFilepaths } = validationReport.getValue();

  return {
    path: fileIndex.path, symbolTable: fileSymbol.symbolTable, symbolIdGenerator, nodeToSymbol, externalFilepaths,
    errors: [...fileIndex.errors, ...validationReport.getErrors()],
    warnings: [...fileIndex.warnings, ...validationReport.getWarnings()],
  };
}
