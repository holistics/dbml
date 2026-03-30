import { NodeSymbol, SchemaSymbol } from '@/core/analyzer/symbol/symbols';
import { NodeToRefereeMap, NodeToSymbolMap, SymbolToReferencesMap } from '@/core/analyzer/analyzer';
import Report from '@/core/report';
import { ProgramNode, SyntaxNode } from '@/index';
import type Compiler from '@/compiler/index';
import { DEFAULT_ENTRY } from '@/compiler/constants';
import { InternedMap } from '@/core/internable';
import { Filepath } from '@/compiler/projectLayout';
import Validator from '@/core/analyzer/validator/validator';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import fs from 'fs';

function validateFile (compiler: Compiler, filepath: Filepath): Report<{ symbolTable: SymbolTable; nodeToSymbol: NodeToSymbolMap }> {
  const nodeToSymbol: NodeToSymbolMap = new InternedMap();
  return compiler.parseFile(filepath).chain(({ ast }) => {
    const symbolFactory = new SymbolFactory(compiler.symbolIdGenerator, filepath);
    return new Validator({ ast }, { nodeToSymbol }, symbolFactory).validate().map(({ nodeToSymbol: ntm }) => {
      const rootSymbol = ntm.get(ast) as SchemaSymbol;
      return { symbolTable: rootSymbol.symbolTable, nodeToSymbol: ntm };
    });
  });
}

export function scanTestNames (_path: any) {
  const files = fs.readdirSync(_path);

  return files.filter((fn) => fn.match(/\.in\./)).map((fn) => fn.split('.in.')[0]);
}

export function createJsonReplacer (
  nodeToSymbol: NodeToSymbolMap | undefined,
  nodeToReferee: NodeToRefereeMap | undefined,
  symbolToReferences?: SymbolToReferencesMap,
) {
  return function (this: any, key: string, value: any) {
    // Inject symbol/referee from maps into SyntaxNode instances.
    // Guards: 'parent' and 'declaration' must output just the node ID, not a subtree.
    if (nodeToSymbol && value instanceof SyntaxNode && key !== 'parent' && key !== 'declaration') {
      const sym = nodeToSymbol.get(value as SyntaxNode);
      const ref = nodeToReferee?.get(value as SyntaxNode);
      if (sym !== undefined || ref !== undefined) {
        const augmented = Object.assign(Object.create(Object.getPrototypeOf(value)), value);
        if (sym !== undefined) augmented.symbol = sym;
        if (ref !== undefined) augmented.referee = ref;
        return augmented;
      }
    }

    // For non-root nodes: output just the symbol's ID (avoids circular refs)
    if (!(this instanceof ProgramNode) && key === 'symbol') {
      return (value as NodeSymbol)?.id;
    }

    // Don't include source or filepath in the serialized AST
    if (this instanceof ProgramNode && key === 'source') {
      return undefined;
    }
    if (key === 'filepath') {
      return undefined;
    }

    // For root node symbol: output full symbol table with reference IDs
    if (key === 'symbol') {
      return {
        symbolTable: (value as NodeSymbol)?.symbolTable,
        id: (value as NodeSymbol)?.id,
        references: (symbolToReferences?.get(value as NodeSymbol) ?? []).map((ref) => ref.id),
        declaration: (value as NodeSymbol)?.declaration?.id,
      };
    }

    // For referee references: output only the symbol ID
    if (key === 'referee') {
      return (value as NodeSymbol)?.id;
    }

    // For parent references: output only the node ID (avoids circular refs)
    if (key === 'parent') {
      return (value as SyntaxNode)?.id;
    }

    // For declaration references: output only the node ID
    if (key === 'declaration') {
      return (value as SyntaxNode)?.id;
    }

    // For symbol tables: convert Map to Object for JSON serialization,
    // injecting references from SymbolToReferencesMap into each symbol entry
    if (key === 'symbolTable') {
      if (value == null || !(value as any).table) {
        return value;
      }
      const entries: [string, any][] = [...(value as any).table].map(([k, sym]: [string, NodeSymbol]) => {
        if (!sym) {
          return [k, sym];
        }
        const refs = symbolToReferences?.get(sym) ?? [];
        return [k, { references: refs, id: sym.id, symbolTable: sym.symbolTable, declaration: sym.declaration }];
      });
      return Object.fromEntries(entries);
    }

    return value;
  };
}

/**
 * Serializes a `Report<ProgramNode>` to JSON.
 * Nodes carry no symbol/referee data; only the AST structure and errors are emitted.
 */
export function serializeAst (report: Readonly<Report<ProgramNode>>, pretty = false): string {
  return JSON.stringify(report, createJsonReplacer(undefined, undefined), pretty ? 2 : 0);
}

/**
 * Serializes a `Report<AnalysisResult>` to JSON.
 * Symbol and referee data are injected back into nodes during traversal so the
 * output format matches the pre-immutability snapshots.
 */
export function serializeAnalysis (compiler: Compiler, pretty = false): string {
  const { ast } = compiler.parseFile(DEFAULT_ENTRY).getValue();
  const analysisReport = compiler.analyzeProject(DEFAULT_ENTRY);
  const { nodeToSymbol, nodeToReferee, symbolToReferences } = analysisReport.getValue();
  const errors = analysisReport.getErrors();
  const warnings = analysisReport.getWarnings();
  const report = { value: ast, errors, ...(warnings.length ? { warnings } : {}) };
  return JSON.stringify(report, createJsonReplacer(nodeToSymbol, nodeToReferee, symbolToReferences), pretty ? 2 : 0);
}

/**
 * Serializes validation-only results from a Compiler to JSON.
 * Only includes nodeToSymbol (no binding/referee data).
 */
export function serializeValidation (compiler: Compiler, pretty = false): string {
  const { ast } = compiler.parseFile(DEFAULT_ENTRY).getValue();
  const validated = validateFile(compiler, DEFAULT_ENTRY);
  const errors = [...validated.getErrors()];
  const report = { value: ast, errors };
  return JSON.stringify(report, createJsonReplacer(validated.getValue().nodeToSymbol, undefined), pretty ? 2 : 0);
}
