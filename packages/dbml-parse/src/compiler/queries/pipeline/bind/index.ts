import type Compiler from '../../../index';
import type { NodeToSymbolMap, NodeToRefereeMap, SymbolToReferencesMap } from '@/core/types';
import type { SyntaxNode } from '@/core/parser/nodes';
import type { NodeSymbol } from '@/core/validator/symbol/symbols';
import { Filepath } from '../../../projectLayout';
import type { CompileWarning } from '@/core/errors';
import { DEFAULT_ENTRY } from '../../../constants';
import Binder from '@/core/binder/binder';
import SymbolFactory from '@/core/validator/symbol/factory';
import { ExternalSymbol } from '@/core/validator/symbol/symbols';
import { createNodeSymbolIndex } from '@/core/validator/symbol/symbolIndex';
import SymbolTable from '@/core/validator/symbol/symbolTable';
import Report from '@/core/report';
import { CompileError } from '@/core/errors';
import { resolveExternalDependencies } from './utils';

// Given a node, return its symbol with ExternalSymbols resolved to the actual symbol they reference.
export function resolvedSymbol (this: Compiler, node: SyntaxNode, filepath: Filepath = DEFAULT_ENTRY): NodeSymbol | undefined {
  const symbol = this.validateFile(filepath).nodeToSymbol.get(node);
  if (!(symbol instanceof ExternalSymbol)) return symbol;
  const resolvedId = createNodeSymbolIndex(symbol.name, symbol.kind);
  return this.resolvedSymbolTable(filepath).getValue().symbolTable.get(resolvedId) ?? symbol;
}

// Resolve external symbols for a single file.
// Returns the resolved symbol table and nodeToSymbol map.
export function resolvedSymbolTable (this: Compiler, filepath: Filepath = DEFAULT_ENTRY): Report<{
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

  return new Report(
    { symbolTable: resolved.getValue(), nodeToSymbol: local.nodeToSymbol },
    errors,
    warnings,
  );
}

// Resolve external symbols and bind references for a single file.
export function bindFile (this: Compiler, filepath: Filepath = DEFAULT_ENTRY): Report<{
  readonly symbolTable: Readonly<SymbolTable>;
  readonly nodeToSymbol: NodeToSymbolMap;
  readonly nodeToReferee: NodeToRefereeMap;
  readonly symbolToReferences: SymbolToReferencesMap;
}> {
  const resolved = this.resolvedSymbolTable(filepath);
  const errors = [...resolved.getErrors()];
  const warnings = [...resolved.getWarnings()];

  if (errors.length > 0) {
    return new Report(
      { symbolTable: new SymbolTable(), nodeToSymbol: resolved.getValue().nodeToSymbol, nodeToReferee: new WeakMap(), symbolToReferences: new Map() },
      errors,
      warnings,
    );
  }

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
