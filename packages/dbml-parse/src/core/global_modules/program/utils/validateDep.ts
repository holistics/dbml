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

// A complex Dep block groups edges under one downstream table.
// Mixing downstreams in a single block or splitting one table across blocks
// would make the grouping semantically ambiguous.
export function validateDepBlocks (dep: Dep, meta: NodeMetadata, seenComplexDownstream: Set<string>): CompileError[] {
  const edges = dep.edges ?? [];
  if (edges.length === 0) return [];

  if (!isComplexDep(meta)) return [];

  // Rule 1: all edges in a complex dep block must share the same downstream table
  const firstKey = makeTableKey(edges[0].downstream.schemaName, edges[0].downstream.tableName);
  for (let i = 1; i < edges.length; i++) {
    const key = makeTableKey(edges[i].downstream.schemaName, edges[i].downstream.tableName);
    if (key !== firstKey) {
      return [
        new CompileError(
          CompileErrorCode.DEP_MIXED_DOWNSTREAM_TABLES,
          `All edges in a Dep block must target the same downstream table, but found '${firstKey}' and '${key}'`,
          meta.declaration,
        ),
      ];
    }
  }

  // Rule 2: a downstream table can only appear in one complex dep block
  if (seenComplexDownstream.has(firstKey)) {
    return [
      new CompileError(
        CompileErrorCode.DEP_DUPLICATE_DOWNSTREAM_TABLE,
        `Downstream table '${firstKey}' is already targeted by another Dep block`,
        meta.declaration,
      ),
    ];
  }
  seenComplexDownstream.add(firstKey);

  return [];
}
