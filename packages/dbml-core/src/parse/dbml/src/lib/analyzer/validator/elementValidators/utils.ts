import { ElementDeclarationNode, NormalExpressionNode } from '../../../parser/nodes';
import {
  createColumnSymbolId,
  createSchemaSymbolId,
  createTableSymbolId,
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

  const columnId = createColumnSymbolId(fragments.pop()!);
  if (fragments.length === 0) {
    unresolvedNames.push({
      id: columnId,
      ownerElement,
      referrer: node,
    });

    return;
  }

  const tableId = createTableSymbolId(fragments.pop()!);
  const schemaIdStack = fragments.map(createSchemaSymbolId);

  unresolvedNames.push({
    id: columnId,
    qualifiers: [...schemaIdStack, tableId],
    ownerElement,
    referrer: node,
  });
}
