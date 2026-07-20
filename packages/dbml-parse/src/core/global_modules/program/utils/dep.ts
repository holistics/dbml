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

// A complex Dep block must have all edges targeting the same downstream table.
export function validateDepBlocks (
  dep: Dep,
  meta: NodeMetadata,
): CompileError[] {
  const edges = dep.edges ?? [];
  if (edges.length === 0) return [];

  if (!isComplexDep(meta)) return [];

  const errors: CompileError[] = [];

  // All edges in a complex dep block must share the same downstream table
  const firstDownstream = makeTableKey(edges[0].downstream.schemaName, edges[0].downstream.tableName);

  for (let i = 1; i < edges.length; i++) {
    const curDownstream = makeTableKey(edges[i].downstream.schemaName, edges[i].downstream.tableName);

    if (curDownstream !== firstDownstream) {
      errors.push(new CompileError(
        CompileErrorCode.DEP_MIXED_DOWNSTREAM_TABLES,
        `All edges in a Dep block must target the same downstream table, but found '${firstDownstream}' and '${curDownstream}'`,
        meta.declaration,
      ));
      break;
    }
  }

  // All edges in a block must be at the same level (all table-level or all column-level)
  const isColumnLevel = (e: typeof edges[0]) => e.upstream.fieldNames.length > 0 || e.downstream.fieldNames.length > 0;
  const firstLevel = isColumnLevel(edges[0]);

  for (let i = 1; i < edges.length; i++) {
    if (isColumnLevel(edges[i]) !== firstLevel) {
      errors.push(new CompileError(
        CompileErrorCode.DEP_MIXED_LEVEL,
        'All edges in a Dep block must be at the same level (all table-level or all column-level)',
        meta.declaration,
      ));
      break;
    }
  }

  return errors;
}
