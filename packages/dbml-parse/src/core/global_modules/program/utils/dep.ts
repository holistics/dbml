import { CompileError, CompileErrorCode } from '@/core/types/errors';
import type { Dep } from '@/core/types/schemaJson';
import { BlockExpressionNode, ElementDeclarationNode } from '@/core/types/nodes';
import { DepMetadata } from '@/core/types/symbol/metadata';
import type { NodeMetadata } from '@/core/types/symbol/metadata';
import { makeTableKey } from '../../records/utils/constraints/helper';

function isComplexDep (meta: NodeMetadata): boolean {
  return meta instanceof DepMetadata
    && meta.declaration instanceof ElementDeclarationNode
    && meta.declaration.body instanceof BlockExpressionNode;
}

// A complex Dep block has exclusive ownership of its downstream table.
// No other dep (simple, inline, or complex) can also target it.
// Multiple simple/inline deps can share a downstream table freely.
export function validateDepBlocks (
  dep: Dep,
  meta: NodeMetadata,
  seenDownstream: Map<string, boolean>, // value: true = claimed by complex block
): CompileError[] {
  const edges = dep.edges ?? [];
  if (edges.length === 0) return [];

  const complex = isComplexDep(meta);

  if (complex) {
    // Rule 1: all edges in a complex dep block must share the same downstream table
    const firstDownstream = makeTableKey(edges[0].downstream.schemaName, edges[0].downstream.tableName);

    for (let i = 1; i < edges.length; i++) {
      const curDownstream = makeTableKey(edges[i].downstream.schemaName, edges[i].downstream.tableName);

      if (curDownstream !== firstDownstream) {
        return [
          new CompileError(
            CompileErrorCode.DEP_MIXED_DOWNSTREAM_TABLES,
            `All edges in a Dep block must target the same downstream table, but found '${firstDownstream}' and '${curDownstream}'`,
            meta.declaration,
          ),
        ];
      }
    }

    // Rule 2: complex block claims exclusive ownership, no other dep can target this table
    if (seenDownstream.has(firstDownstream)) {
      return [
        new CompileError(
          CompileErrorCode.DEP_DUPLICATE_DOWNSTREAM_TABLE,
          `Downstream table '${firstDownstream}' is already targeted by another Dep block`,
          meta.declaration,
        ),
      ];
    }
    seenDownstream.set(firstDownstream, true);
  } else {
    // Simple/inline: register downstream tables, error if a complex block already claimed any
    for (const edge of edges) {
      const downstream = makeTableKey(edge.downstream.schemaName, edge.downstream.tableName);
      if (seenDownstream.get(downstream) === true) {
        return [
          new CompileError(
            CompileErrorCode.DEP_DUPLICATE_DOWNSTREAM_TABLE,
            `Downstream table '${downstream}' is already targeted by a Dep block`,
            meta.declaration,
          ),
        ];
      }
      if (!seenDownstream.has(downstream)) {
        seenDownstream.set(downstream, false);
      }
    }
  }

  return [];
}
