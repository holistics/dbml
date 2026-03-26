import type Compiler from '../../../index';
import type { NodeToSymbolMap, NodeToRefereeMap, SymbolToReferencesMap } from '@/core/types';
import { Filepath } from '../../../projectLayout';
import type { CompileWarning } from '@/core/errors';
import Binder from '@/core/analyzer/binder/binder';
import Validator from '@/core/analyzer/validator/validator';
import SymbolFactory from '@/core/analyzer/validator/symbol/factory';
import { NodeSymbolIdGenerator, SchemaSymbol } from '@/core/analyzer/validator/symbol/symbols';
import SymbolTable from '@/core/analyzer/validator/symbol/symbolTable';
import Report from '@/core/report';
import { CompileError } from '@/core/errors';
import { resolveExternalDependencies } from './utils';

export type AnalyzeResult = {
  readonly symbolTable: Readonly<SymbolTable>;
  readonly nodeToSymbol: NodeToSymbolMap;
  readonly nodeToReferee: NodeToRefereeMap;
  readonly symbolToReferences: SymbolToReferencesMap;
};

// Validate, resolve external symbols, and bind references for a single file.
export function analyzeFile (this: Compiler, filepath: Filepath): Report<AnalyzeResult> {
  // Validate
  const fileIndex = this.parseFile(filepath);
  const symbolIdGenerator = new NodeSymbolIdGenerator();
  const symbolFactory = new SymbolFactory(symbolIdGenerator, filepath);
  const nodeToSymbol: NodeToSymbolMap = new Map();
  const fileSymbol = symbolFactory.create(SchemaSymbol, { symbolTable: new SymbolTable() });
  nodeToSymbol.set(fileIndex.ast, fileSymbol);

  const validationReport = new Validator({ ast: fileIndex.ast, filepath, nodeToSymbol }, symbolFactory).validate();
  const errors: CompileError[] = [...fileIndex.errors, ...validationReport.getErrors()];
  const warnings: CompileWarning[] = [...fileIndex.warnings, ...validationReport.getWarnings()];

  // Resolve external dependencies
  const resolved = resolveExternalDependencies(this, filepath, {
    symbolTable: fileSymbol.symbolTable,
    symbolIdGenerator,
    nodeToSymbol,
  });
  errors.push(...resolved.getErrors());

  // Replace root symbol with resolved version
  nodeToSymbol.set(fileIndex.ast, symbolFactory.create(SchemaSymbol, { symbolTable: resolved.getValue() }));

  // Bind references
  const nodeToReferee: NodeToRefereeMap = new WeakMap();
  const symbolToReferences: SymbolToReferencesMap = new Map();
  const bindingReport = new Binder(
    { ast: fileIndex.ast, nodeToSymbol, nodeToReferee, symbolToReferences },
    symbolFactory,
  ).resolve();

  return new Report(
    {
      symbolTable: resolved.getValue(),
      nodeToSymbol,
      nodeToReferee,
      symbolToReferences,
    },
    [...errors, ...bindingReport.getErrors()],
    [...warnings, ...bindingReport.getWarnings()],
  );
}
