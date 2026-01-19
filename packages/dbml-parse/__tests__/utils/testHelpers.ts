import { NodeSymbol } from '@/core/analyzer/symbol/symbols';
import Report from '@/core/report';
import { ProgramNode, SyntaxNode } from '@/index';
import fs from 'fs';

export function scanTestNames (_path: any) {
  const files = fs.readdirSync(_path);

  return files.filter((fn) => fn.match(/\.in\./)).map((fn) => fn.split('.in.')[0]);
}

/**
 * Serializes a compiler report to JSON, handling circular references and
 * reducing verbosity by outputting IDs instead of full objects where appropriate.
 *
 * The serializer handles special keys:
 * - 'symbol': For non-root nodes, outputs only the symbol ID. For root nodes,
 *   outputs the full symbol table with references as IDs.
 * - 'referee': Outputs only the referenced symbol's ID
 * - 'parent': Outputs only the parent node's ID
 * - 'declaration': Outputs only the declaration node's ID
 * - 'symbolTable': Converts Map to Object for JSON compatibility
 */
export function serialize (
  report: Readonly<Report<ProgramNode>>,
  pretty: boolean = false,
): string {
  return JSON.stringify(
    report,
    function (key: string, value: any) {
      // For non-root nodes: output just the symbol's ID (avoids circular refs)
      if (!(this instanceof ProgramNode) && key === 'symbol') {
        return (value as NodeSymbol)?.id;
      }

      // For root node symbol: output full symbol table with reference IDs
      if (key === 'symbol') {
        return {
          symbolTable: (value as NodeSymbol)?.symbolTable,
          id: (value as NodeSymbol)?.id,
          references: (value as NodeSymbol)?.references.map((ref) => ref.id),
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
    },
    pretty ? 2 : 0,
  );
}
