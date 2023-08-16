import { SyntaxToken, SyntaxTokenKind } from '../lexer/tokens';
import { None, Option, Some } from '../option';
import { extractVariableNode, isExpressionAnIdentifierNode, last } from '../utils';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  ExpressionNode,
  IdentiferStreamNode,
  ListExpressionNode,
  NormalExpressionNode,
} from './nodes';

// Try to interpret a function application as an element
export function convertFuncAppToElem(
  callee: ExpressionNode,
  args: NormalExpressionNode[],
): Option<ElementDeclarationNode> {
  if (!isExpressionAnIdentifierNode(callee) || args.length === 0) {
    return new None();
  }
  const cpArgs = [...args];

  const type = extractVariableNode(callee).unwrap();

  const body = cpArgs.pop();
  if (!(body instanceof BlockExpressionNode)) {
    return new None();
  }

  const attributeList =
    last(cpArgs) instanceof ListExpressionNode ? (cpArgs.pop() as ListExpressionNode) : undefined;

  if (cpArgs.length === 3 && extractVariableNode(cpArgs[1]).unwrap().value === 'as') {
    return new Some(
      new ElementDeclarationNode({
        type,
        name: cpArgs[0],
        as: extractVariableNode(cpArgs[1]).unwrap(),
        alias: cpArgs[2],
        attributeList,
        body,
      }),
    );
  }

  if (cpArgs.length === 1) {
    return new Some(
      new ElementDeclarationNode({
        type,
        name: cpArgs[0],
        attributeList,
        body,
      }),
    );
  }

  if (cpArgs.length === 0) {
    return new Some(
      new ElementDeclarationNode({
        type,
        attributeList,
        body,
      }),
    );
  }

  return new None();
}

// Check if a token is an `as` keyword
export function isAsKeyword(
  token: SyntaxToken,
): token is SyntaxToken & { kind: SyntaxTokenKind.IDENTIFIER; value: 'as' } {
  return token.kind === SyntaxTokenKind.IDENTIFIER && token.value === 'as';
}

// Check if an attribute components are valid to build an AttributeNode
export function canBuildAttributeNode(
  name: IdentiferStreamNode | undefined,
  colon: SyntaxToken | undefined,
  value: ExpressionNode | IdentiferStreamNode | undefined,
): name is IdentiferStreamNode {
  if (!name) {
    return false;
  }

  if (colon && !value) {
    return false;
  }

  if (!colon && value) {
    return false;
  }

  return true;
}
