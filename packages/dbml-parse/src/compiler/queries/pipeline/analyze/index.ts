import type Compiler from '../../../index';
import type { AnalysisResult, NodeToSymbolMap, NodeToRefereeMap, SymbolToReferencesMap } from '@/core/analyzer/analyzer';
import { Filepath } from '../../../projectLayout';
import type { CompileWarning } from '@/core/errors';
import Binder from '@/core/analyzer/binder/binder';
import Validator from '@/core/analyzer/validator/validator';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import { SchemaSymbol } from '@/core/analyzer/symbol/symbols';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import Report from '@/core/report';
import { CompileError } from '@/core/errors';
import { ProgramNode } from '@/core/parser/nodes';
import { resolveExternalDependencies } from './utils';

export type ValidateFileResult = {
  readonly symbolTable: SymbolTable;
  readonly nodeToSymbol: NodeToSymbolMap;
};

// Cached per AST node: same AST always yields the same symbols.
const validateFileCache = new WeakMap<ProgramNode, Report<ValidateFileResult>>();

// Validate a single file locally (no cross-file resolution).
// Cached so that the same syntax nodes always map to the same symbols.
export function validateFile (compiler: Compiler, filepath: Filepath): Report<ValidateFileResult> {
  const parseReport = compiler.parseFile(filepath);
  const { ast } = parseReport.getValue();

  const cached = validateFileCache.get(ast);
  if (cached) return cached;

  const symbolFactory = new SymbolFactory(compiler.symbolIdGenerator, filepath);

  const validationReport = new Validator(
    ast,
    symbolFactory,
  ).validate();

  const { nodeToSymbol } = validationReport.getValue();
  const rootSymbol = nodeToSymbol.get(ast) as SchemaSymbol;

  const result = new Report(
    {
      symbolTable: rootSymbol.symbolTable,
      nodeToSymbol,
    },
    [...parseReport.getErrors(), ...validationReport.getErrors()],
    [...parseReport.getWarnings(), ...validationReport.getWarnings()],
  );

  validateFileCache.set(ast, result);
  return result;
}

// Analyze all files in the project. Returns a map of filepath -> AnalysisResult.
export function analyzeProject (this: Compiler): Map<Filepath, Report<AnalysisResult>> {
  const results = new Map<Filepath, Report<AnalysisResult>>();
  for (const fp of this.layout().listAllFiles()) {
    results.set(fp, this.analyzeFile(fp));
  }
  return results;
}

// Validate, resolve external symbols, and bind references for a single file.
// AnalysisResult's symbolToReferences only covers this file and its dependencies, not files that import from it.
// Example: b.dbml imports from a.dbml, then
// analyzeFile('a.dbml') won't include b's references because a.dbml cannot know that b.dbml imports from it.
// Use compiler.nodeReferences() for project-wide lookup.
export function analyzeFile (this: Compiler, filepath: Filepath): Report<AnalysisResult> {
  const { ast } = this.parseFile(filepath).getValue();
  const validationReport = validateFile(this, filepath);
  const { symbolTable, nodeToSymbol } = validationReport.getValue();
  const symbolFactory = new SymbolFactory(this.symbolIdGenerator, filepath);

  const errors: CompileError[] = [...validationReport.getErrors()];
  const warnings: CompileWarning[] = [...validationReport.getWarnings()];

  const resolveReport = resolveExternalDependencies(this, ast, {
    symbolTable,
    nodeToSymbol,
  });
  errors.push(...resolveReport.getErrors());

  const nodeToReferee: NodeToRefereeMap = new WeakMap();
  const symbolToReferences: SymbolToReferencesMap = new WeakMap();
  const bindingReport = new Binder(
    { ast, nodeToSymbol, nodeToReferee, symbolToReferences },
    symbolFactory,
  ).resolve();
  errors.push(...bindingReport.getErrors());
  warnings.push(...bindingReport.getWarnings());

  return new Report(
    {
      ast,
      nodeToSymbol,
      nodeToReferee,
      symbolToReferences,
    },
    errors,
    warnings,
  );
}
