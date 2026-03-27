import { Filepath, FilepathId } from '@/compiler/projectLayout';
import type Compiler from '../../../index';
import { AnalysisResult, NodeToSymbolMap, NodeToRefereeMap, SymbolToReferencesMap } from '@/core/analyzer/analyzer';
import { InternedMap } from '@/core/internable';
import Validator from '@/core/analyzer/validator/validator';
import Binder from '@/core/analyzer/binder/binder';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import { SchemaSymbol } from '@/core/analyzer/symbol/symbols';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import Report from '@/core/report';
import { CompileError, CompileErrorCode } from '@/core/errors';
import { ElementKind } from '@/core/analyzer/types';
import { getElementKind } from '@/core/analyzer/utils';
import { resolveExternalDependencies } from './utils';

export type ValidateFileResult = {
  readonly symbolTable: SymbolTable;
  readonly nodeToSymbol: NodeToSymbolMap;
};

export function validateFile (compiler: Compiler, filepath: Filepath): Report<ValidateFileResult> {
  const nodeToSymbol: NodeToSymbolMap = new InternedMap();
  return compiler.parseFile(filepath).chain(({ ast }) => {
    const symbolFactory = new SymbolFactory(compiler.symbolIdGenerator, filepath);
    return new Validator({ ast }, { nodeToSymbol }, symbolFactory).validate().map(({ nodeToSymbol: ntm }) => {
      const rootSymbol = ntm.get(ast) as SchemaSymbol;
      return { symbolTable: rootSymbol.symbolTable, nodeToSymbol: ntm };
    });
  });
}

// Collect a file and all its transitive dependencies in dependency order.
export function collectTransitiveDependencies (compiler: Compiler, entrypoint: Filepath): Filepath[] {
  const visited = new Set<FilepathId>();
  const order: Filepath[] = [];

  const collect = (fp: Filepath) => {
    const id = fp.intern();
    if (visited.has(id)) return;
    visited.add(id);
    order.push(fp);

    for (const depId of compiler.localFileDependencies(fp)) {
      collect(Filepath.from(depId));
    }
  };
  collect(entrypoint);
  return order;
}

// If entrypoint is provided, only that file and its transitive dependencies are analyzed.
// If entrypoint is undefined, all files in the project are analyzed.
export function analyzeProject (this: Compiler, entrypoint?: Filepath): Report<AnalysisResult> {
  const files = entrypoint
    ? collectTransitiveDependencies(this, entrypoint)
    : this.layout().listAllFiles();

  const nodeToSymbol: NodeToSymbolMap = new InternedMap();

  // Validate to build up the symbols
  const validateReport = Report.concat(
    ...files.map((file) =>
      this.parseFile(file).chain(({ ast }) => {
        const symbolFactory = new SymbolFactory(this.symbolIdGenerator, file);
        return new Validator({ ast }, { nodeToSymbol }, symbolFactory).validate();
      }),
    ),
  );

  // Enforce at most one Project element across all files
  const allProjects = files.flatMap((file) => {
    const { ast } = this.parseFile(file).getValue();
    return ast.declarations.filter((e) => getElementKind(e).unwrap_or(undefined) === ElementKind.Project);
  });
  const projectErrors: CompileError[] = [];
  if (allProjects.length > 1) {
    allProjects.forEach((project) => projectErrors.push(
      new CompileError(CompileErrorCode.PROJECT_REDEFINED, 'Only one Project element can exist across all files', project),
    ));
  }

  // Resolve external dependencies (use declarations)
  const resolveReport = Report.concat(
    ...files.map((file) => {
      const { ast } = this.parseFile(file).getValue();
      const rootSymbol = nodeToSymbol.get(ast) as SchemaSymbol;
      return resolveExternalDependencies(this, ast, {
        symbolTable: rootSymbol.symbolTable,
        nodeToSymbol,
      });
    }),
  );

  const nodeToReferee: NodeToRefereeMap = new InternedMap();
  const symbolToReferences: SymbolToReferencesMap = new InternedMap();

  // Resolve partial injections
  const partialInjectionReport = Report.concat(
    ...files.map((file) => {
      const { ast } = this.parseFile(file).getValue();
      const symbolFactory = new SymbolFactory(this.symbolIdGenerator, file);
      const binder = new Binder({ ast }, { nodeToSymbol, nodeToReferee, symbolToReferences }, symbolFactory);
      const errors = binder.resolvePartialInjections({
        ast,
        nodeToSymbol,
        nodeToReferee,
        symbolToReferences,
      });
      return new Report(undefined, errors);
    }),
  );

  // Bind references
  const bindReport = Report.concat(
    ...files.map((file) => {
      const { ast } = this.parseFile(file).getValue();
      const symbolFactory = new SymbolFactory(this.symbolIdGenerator, file);
      const binder = new Binder({ ast }, { nodeToSymbol, nodeToReferee, symbolToReferences }, symbolFactory);
      return binder.resolve();
    }),
  );

  return Report.concat<unknown>(validateReport, new Report(undefined, projectErrors), resolveReport, partialInjectionReport, bindReport)
    .map(() => ({ nodeToSymbol, nodeToReferee, symbolToReferences }));
}
