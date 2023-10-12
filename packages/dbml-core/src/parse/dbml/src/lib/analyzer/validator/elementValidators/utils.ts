import { CompileError, CompileErrorCode } from '../../../errors';
import { ElementDeclarationNode, NormalExpressionNode, SyntaxNode } from '../../../parser/nodes';
import {
  createColumnSymbolIndex,
  createSchemaSymbolIndex,
  createTableSymbolIndex,
} from '../../symbol/symbolIndex';
import { BindingRequest, createNonIgnorableBindingRequest } from '../../types';
import { destructureMemberAccessExpression, extractVariableFromExpression } from '../../utils';
import { ElementKind } from '../types';

// Register a relationship operand for later resolution
// eslint-disable-next-line import/prefer-default-export
export function registerRelationshipOperand(
  node: NormalExpressionNode,
  ownerElement: ElementDeclarationNode,
  bindingRequests: BindingRequest[],
) {
  const fragments = destructureMemberAccessExpression(node).unwrap();
  const column = fragments.pop()!;
  const columnId = createColumnSymbolIndex(extractVariableFromExpression(column).unwrap());
  if (fragments.length === 0) {
    bindingRequests.push(
      createNonIgnorableBindingRequest({
        subnames: [{ index: columnId, referrer: column }],
        ownerElement,
      }),
    );

    return;
  }
  const table = fragments.pop()!;
  const tableId = createTableSymbolIndex(extractVariableFromExpression(table).unwrap());
  const schemaStack = fragments.map((s) => ({
    index: createSchemaSymbolIndex(extractVariableFromExpression(s).unwrap()),
    referrer: s,
  }));

  bindingRequests.push(
    createNonIgnorableBindingRequest({
      subnames: [
        ...schemaStack,
        { referrer: table, index: tableId },
        { referrer: column, index: columnId },
      ],
      ownerElement,
    }),
  );
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
