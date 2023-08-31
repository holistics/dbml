import { CompileError, CompileErrorCode } from '../../../errors';
import { ElementDeclarationNode, NormalExpressionNode, SyntaxNode } from '../../../parser/nodes';
import {
  createColumnSymbolIndex,
  createSchemaSymbolIndex,
  createTableSymbolIndex,
} from '../../symbol/symbolIndex';
import { UnresolvedName } from '../../types';
import { destructureComplexVariable } from '../../utils';
import { ElementKind } from '../types';

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

export function isCustomElement(kind: ElementKind): kind is ElementKind.CUSTOM {
  return kind === ElementKind.CUSTOM;
}

export function getSubfieldKind(kind: ElementKind): string {
  switch (kind) {
    case ElementKind.TABLE:
      return 'column';
    case ElementKind.ENUM:
      return 'field';
    case ElementKind.TABLEGROUP:
      return 'table';
    default:
      return 'subfield';
  }
}

export function transformToReturnCompileErrors(
  validator: (node: SyntaxNode, ith: number) => boolean,
  errorCode: CompileErrorCode,
  errorMessage: string,
): (node: SyntaxNode, ith: number) => CompileError[] {
  return (node: SyntaxNode, ith: number) => {
    if (validator(node, ith)) {
      return [];
    }

    return [new CompileError(errorCode, errorMessage, node)];
  };
}
