import type Compiler from '../../../index';
import type { NodeToSymbolMap, NodeToRefereeMap, SymbolToReferencesMap } from '@/core/types';
import type { SyntaxNode } from '@/core/parser/nodes';
import type { NodeSymbol } from '@/core/validator/symbol/symbols';
import { Filepath } from '../../../projectLayout';
import type { CompileWarning } from '@/core/errors';
import { DEFAULT_ENTRY } from '../../../constants';
import Binder from '@/core/binder/binder';
import SymbolFactory from '@/core/validator/symbol/factory';
import { SchemaSymbol } from '@/core/validator/symbol/symbols';
import SymbolTable from '@/core/validator/symbol/symbolTable';
import Report from '@/core/report';
import { CompileError } from '@/core/errors';
import { resolveExternalDependencies } from './utils';

// Given a node, return its symbol with ExternalSymbols resolved to the actual symbol they reference.
export function resolvedSymbol (this: Compiler, node: SyntaxNode, filepath: Filepath): NodeSymbol | undefined {
  return this.resolvedSymbolTable(filepath).getValue().nodeToSymbol.get(node);
}

// Resolve external symbols for a single file.
// Returns the resolved symbol table and nodeToSymbol map.
export function resolvedSymbolTable (this: Compiler, filepath: Filepath): Report<{
  readonly symbolTable: Readonly<SymbolTable>;
  readonly nodeToSymbol: NodeToSymbolMap;
}> {
  const local = this.validateFile(filepath);
  const errors: CompileError[] = [...local.errors];
  const warnings: CompileWarning[] = [...local.warnings];

  if (errors.length > 0) {
    return new Report(
      { symbolTable: new SymbolTable(), nodeToSymbol: local.nodeToSymbol },
      errors,
      warnings,
    );
  }

  const resolved = resolveExternalDependencies(this, filepath);
  errors.push(...resolved.getErrors());

  const fileIndex = this.parseFile(filepath);
  const nodeToSymbol = new Map(local.nodeToSymbol);
  nodeToSymbol.set(fileIndex.ast, new SymbolFactory(local.symbolIdGenerator, filepath)
    .create(SchemaSymbol, { symbolTable: resolved.getValue() }));

  return new Report(
    { symbolTable: resolved.getValue(), nodeToSymbol },
    errors,
    warnings,
  );
}

// Resolve external symbols and bind references for a single file.
export function bindFile (this: Compiler, filepath: Filepath): Report<{
  readonly symbolTable: Readonly<SymbolTable>;
  readonly nodeToSymbol: NodeToSymbolMap;
  readonly nodeToReferee: NodeToRefereeMap;
  readonly symbolToReferences: SymbolToReferencesMap;
}> {
  const resolved = this.resolvedSymbolTable(filepath);
  const errors = [...resolved.getErrors()];
  const warnings = [...resolved.getWarnings()];
  const { symbolTable: resolvedTable, nodeToSymbol } = resolved.getValue();
  const { symbolIdGenerator } = this.validateFile(filepath);
  const fileIndex = this.parseFile(filepath);
  const symbolFactory = new SymbolFactory(symbolIdGenerator, filepath);
  const nodeToReferee: NodeToRefereeMap = new WeakMap();
  const symbolToReferences: SymbolToReferencesMap = new Map();

  const bindingReport = new Binder({ ast: fileIndex.ast, nodeToSymbol, nodeToReferee, symbolToReferences }, symbolFactory).resolve();

  return new Report(
    { symbolTable: resolvedTable, nodeToSymbol, nodeToReferee, symbolToReferences },
    [...errors, ...bindingReport.getErrors()],
    [...warnings, ...bindingReport.getWarnings()],
  );
}
