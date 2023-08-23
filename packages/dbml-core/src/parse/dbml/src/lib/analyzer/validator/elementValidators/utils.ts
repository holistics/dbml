import { ElementDeclarationNode, NormalExpressionNode } from '../../../parser/nodes';
import {
  createColumnSymbolIndex,
  createSchemaSymbolIndex,
  createTableSymbolIndex,
} from '../../symbol/symbolIndex';
import { UnresolvedName } from '../../types';
import { destructureComplexVariable } from '../../utils';

// Register a relationship operand for later resolution
// eslint-disable-next-line import/prefer-default-export
export function registerRelationshipOperand(
  node: NormalExpressionNode,
  ownerElement: ElementDeclarationNode,
  unresolvedNames: UnresolvedName[],
) {
  const fragments = destructureComplexVariable(node).unwrap();

  const columnId = createColumnSymbolIndex(fragments.pop()!);
  if (fragments.length === 0) {
    unresolvedNames.push({
      ids: [columnId],
      ownerElement,
      referrer: node,
    });

    return;
  }

  const tableId = createTableSymbolIndex(fragments.pop()!);
  const schemaIdStack = fragments.map(createSchemaSymbolIndex);

  unresolvedNames.push({
    ids: [...schemaIdStack, tableId, columnId],
    ownerElement,
    referrer: node,
  });
}
