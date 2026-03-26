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
import { ProgramNode } from '@/core/parser/nodes';
import { resolveExternalDependencies } from './utils';

export type AnalyzeResult = {
  readonly symbolTable: Readonly<SymbolTable>;
  readonly nodeToSymbol: NodeToSymbolMap;
  readonly nodeToReferee: NodeToRefereeMap;
  readonly symbolToReferences: SymbolToReferencesMap;
};

export type ValidateFileResult = {
  readonly symbolTable: SymbolTable;
  readonly symbolIdGenerator: NodeSymbolIdGenerator;
  readonly symbolFactory: SymbolFactory;
  readonly nodeToSymbol: NodeToSymbolMap;
  readonly errors: readonly CompileError[];
  readonly warnings: readonly CompileWarning[];
};

// Cached per AST node — same file always yields the same symbols.
const validateFileCache = new WeakMap<ProgramNode, ValidateFileResult>();

// Validate a single file locally (no cross-file resolution).
// Cached so that the same syntax nodes always map to the same symbols.
export function validateFile (compiler: Compiler, filepath: Filepath): ValidateFileResult {
  const fileIndex = compiler.parseFile(filepath);

  const cached = validateFileCache.get(fileIndex.ast);
  if (cached) return cached;

  const symbolIdGenerator = new NodeSymbolIdGenerator();
  const symbolFactory = new SymbolFactory(symbolIdGenerator, filepath);
  const nodeToSymbol: NodeToSymbolMap = new Map();
  const fileSymbol = symbolFactory.create(SchemaSymbol, { symbolTable: new SymbolTable() });
  nodeToSymbol.set(fileIndex.ast, fileSymbol);

  const validationReport = new Validator({ ast: fileIndex.ast, filepath, nodeToSymbol }, symbolFactory).validate();

  const result: ValidateFileResult = {
    symbolTable: fileSymbol.symbolTable,
    symbolIdGenerator,
    symbolFactory,
    nodeToSymbol,
    errors: [...fileIndex.errors, ...validationReport.getErrors()],
    warnings: [...fileIndex.warnings, ...validationReport.getWarnings()],
  };

  validateFileCache.set(fileIndex.ast, result);
  return result;
}

// Validate, resolve external symbols, and bind references for a single file.
export function analyzeFile (this: Compiler, filepath: Filepath): Report<AnalyzeResult> {
  const fileIndex = this.parseFile(filepath);
  const { symbolTable, symbolIdGenerator, symbolFactory, nodeToSymbol, errors: validationErrors, warnings: validationWarnings } = validateFile(this, filepath);

  const errors: CompileError[] = [...validationErrors];
  const warnings: CompileWarning[] = [...validationWarnings];

  const resolved = resolveExternalDependencies(this, filepath, {
    symbolTable,
    symbolIdGenerator,
    nodeToSymbol,
  });
  errors.push(...resolved.getErrors());

  nodeToSymbol.set(fileIndex.ast, symbolFactory.create(SchemaSymbol, { symbolTable: resolved.getValue() }));

  // Skip binding when validation had errors to avoid misleading secondary errors
  const nodeToReferee: NodeToRefereeMap = new WeakMap();
  const symbolToReferences: SymbolToReferencesMap = new Map();

  if (errors.length === 0) {
    const bindingReport = new Binder(
      { ast: fileIndex.ast, nodeToSymbol, nodeToReferee, symbolToReferences },
      symbolFactory,
    ).resolve();
    errors.push(...bindingReport.getErrors());
    warnings.push(...bindingReport.getWarnings());
  }

  return new Report(
    {
      symbolTable: resolved.getValue(),
      nodeToSymbol,
      nodeToReferee,
      symbolToReferences,
    },
    errors,
    warnings,
  );
}
