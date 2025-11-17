import { NodeSymbol } from '@/lib/analyzer/symbol/symbols';
import { ProgramNode, SyntaxNode } from '@/lib/parser/nodes';
import Report from '@/lib/report';
import { CompileError } from '@/lib/errors';

export function serialize (
  report: Readonly<Report<ProgramNode, CompileError>>,
  pretty: boolean = false,
): string {
  return JSON.stringify(
    report,
    function (key: string, value: any) {
      // If `value` is not `symbol` of the root node
      // Just output the `symbol`'s id is enough
      // As the symbol's information is already reachable from the root node's symbol
      if (!(this instanceof ProgramNode) && key === 'symbol') {
        return (value as NodeSymbol)?.id;
      }

      // If `value` is the `symbol` of the root node
      // output the symbol table in full,
      // just the ids of the SyntaxNodes that refer to this symbol
      // and just the id the root node declaration are enough
      if (/* this instanceof SyntaxNode && */ key === 'symbol') {
        return {
          symbolTable: (value as NodeSymbol)?.symbolTable,
          id: (value as NodeSymbol)?.id,

          references: (value as NodeSymbol)?.references.map((ref) => ref.id),
          declaration: (value as NodeSymbol)?.declaration?.id,
        };
      }

      // If `value` is the NodeSymbol that a SyntaxNode refers to
      // just the id of the `referee` is enough
      if (/* this instanceof SyntaxNode && */ key === 'referee') {
        return (value as NodeSymbol)?.id;
      }

      // If `value` is the parent element of the current SyntaxNode
      // just the id of the parent is enough
      if (/* this instanceof SyntaxNode && */ key === 'parent') {
        return (value as SyntaxNode)?.id;
      }

      // If `value` is the declaration node that owns this symbol
      // just the id of the declaration node is enough
      if (/* this instanceof NodeSymbol && */ key === 'declaration') {
        return (value as SyntaxNode)?.id;
      }

      // If `value` is the symbol table of a NodeSymbol
      // output the `table` field of `value`
      // The conversion to Object is necessary
      // as by default, Map serializes to {}
      if (/* this instanceof NodeSymbol && */ key === 'symbolTable') {
        return Object.fromEntries((value as any).table);
      }

      return value;
    },
    pretty ? 2 : 0,
  );
}
