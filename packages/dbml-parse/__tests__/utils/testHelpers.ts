import { NodeSymbol } from '@/core/analyzer/symbol/symbols';
import { AnalysisResult, NodeToRefereeMap, NodeToSymbolMap, SymbolToReferencesMap } from '@/core/analyzer/analyzer';
import Report from '@/core/report';
import { ProgramNode, SyntaxNode } from '@/index';
import fs from 'fs';

export function scanTestNames (_path: any) {
  const files = fs.readdirSync(_path);

  return files.filter((fn) => fn.match(/\.in\./)).map((fn) => fn.split('.in.')[0]);
}

// Shared replacer logic for AST serialization.
// Handles circular refs (parent, declaration → id), symbol/referee compaction, etc.
function astReplacer (
  nodeToSymbol: NodeToSymbolMap | undefined,
  nodeToReferee: NodeToRefereeMap | undefined,
  symbolToReferences?: SymbolToReferencesMap,
) {
  return function (this: any, key: string, value: any) {
    // Inject symbol/referee from maps into SyntaxNode instances.
    // Guards: 'parent' and 'declaration' must output just the node ID, not a subtree.
    if (nodeToSymbol && value instanceof SyntaxNode && key !== 'parent' && key !== 'declaration') {
      const sym = nodeToSymbol.get(value);
      const ref = nodeToReferee?.get(value);
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

    // Don't include source in the serialized AST
    if (this instanceof ProgramNode && key === 'source') {
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

    // For symbol tables: convert Map to Object for JSON serialization
    if (key === 'symbolTable') {
      return Object.fromEntries((value as any).table);
    }

    return value;
  };
}

/**
 * Serializes a `Report<ProgramNode>` to JSON.
 * Nodes carry no symbol/referee data; only the AST structure and errors are emitted.
 */
export function serializeAst (report: Readonly<Report<ProgramNode>>, pretty = false): string {
  return JSON.stringify(report, astReplacer(undefined, undefined), pretty ? 2 : 0);
}

/**
 * Serializes a `Report<AnalysisResult>` to JSON.
 * Symbol and referee data are injected back into nodes during traversal so the
 * output format matches the pre-immutability snapshots.
 */
export function serializeAnalysis (report: Readonly<Report<AnalysisResult>>, pretty = false): string {
  const { ast, nodeToSymbol, nodeToReferee, symbolToReferences } = report.getValue();
  const syntheticReport = {
    value: ast,
    errors: report.getErrors(),
    ...(report.getWarnings().length ? { warnings: report.getWarnings() } : {}),
  };
  return JSON.stringify(syntheticReport, astReplacer(nodeToSymbol, nodeToReferee, symbolToReferences), pretty ? 2 : 0);
}
