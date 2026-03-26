import type Compiler from '../../../index';
import type { AnalysisResult, NodeToSymbolMap, NodeToRefereeMap, SymbolToReferencesMap } from '@/core/analyzer/analyzer';
import { Filepath, type FilepathId } from '../../../projectLayout';
import type { CompileWarning } from '@/core/errors';
import Binder from '@/core/analyzer/binder/binder';
import Validator from '@/core/analyzer/validator/validator';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import { NodeSymbolIdGenerator, SchemaSymbol } from '@/core/analyzer/symbol/symbols';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import Report from '@/core/report';
import { CompileError } from '@/core/errors';
import { ProgramNode, UseDeclarationNode } from '@/core/parser/nodes';
import { resolveExternalDependencies } from './utils';

const DBML_EXT = '.dbml';

// Scan use declarations from the parsed AST to extract external file dependencies.
export function localFileDependencies (this: Compiler, filepath: Filepath): ReadonlyMap<FilepathId, UseDeclarationNode> {
  const { ast } = this.parseFile(filepath).getValue();
  const deps = new Map<FilepathId, UseDeclarationNode>();

  for (const node of ast.body) {
    if (!(node instanceof UseDeclarationNode) || !node.path) continue;
    const resolved = Filepath.resolve(filepath.dirname, node.path.value);
    const resolvedPath = resolved.absolute.endsWith(DBML_EXT) ? resolved : Filepath.from(resolved.absolute + DBML_EXT);
    deps.set(resolvedPath.intern(), node);
  }

  return deps;
}

export type ValidateFileResult = {
  readonly symbolTable: SymbolTable;
  readonly symbolIdGenerator: NodeSymbolIdGenerator;
  readonly nodeToSymbol: NodeToSymbolMap;
};

// Cached per AST node — same file always yields the same symbols.
const validateFileCache = new WeakMap<ProgramNode, Report<ValidateFileResult>>();

// Validate a single file locally (no cross-file resolution).
// Cached so that the same syntax nodes always map to the same symbols.
export function validateFile (compiler: Compiler, filepath: Filepath): Report<ValidateFileResult> {
  const parseReport = compiler.parseFile(filepath);
  const { ast } = parseReport.getValue();

  const cached = validateFileCache.get(ast);
  if (cached) return cached;

  const symbolIdGenerator = new NodeSymbolIdGenerator();
  const symbolFactory = new SymbolFactory(symbolIdGenerator, filepath);

  const validationReport = new Validator(
    ast,
    filepath,
    symbolFactory,
  ).validate();

  const { nodeToSymbol } = validationReport.getValue();
  const rootSymbol = nodeToSymbol.get(ast) as SchemaSymbol;

  const result = new Report(
    {
      symbolTable: rootSymbol.symbolTable,
      symbolIdGenerator,
      nodeToSymbol,
    },
    [...parseReport.getErrors(), ...validationReport.getErrors()],
    [...parseReport.getWarnings(), ...validationReport.getWarnings()],
  );

  validateFileCache.set(ast, result);
  return result;
}

// Validate, resolve external symbols, and bind references for a single file.
export function analyzeFile (this: Compiler, filepath: Filepath): Report<AnalysisResult> {
  const { ast } = this.parseFile(filepath).getValue();
  const validationReport = validateFile(this, filepath);
  const { symbolTable, symbolIdGenerator, nodeToSymbol } = validationReport.getValue();
  const symbolFactory = new SymbolFactory(symbolIdGenerator, filepath);

  const errors: CompileError[] = [...validationReport.getErrors()];
  const warnings: CompileWarning[] = [...validationReport.getWarnings()];

  const resolveReport = resolveExternalDependencies(this, filepath, {
    symbolTable,
    symbolIdGenerator,
    nodeToSymbol,
  });
  errors.push(...resolveReport.getErrors());

  const nodeToReferee: NodeToRefereeMap = new WeakMap();
  const symbolToReferences: SymbolToReferencesMap = new Map();
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
