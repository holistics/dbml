import { SyntaxToken, SyntaxTokenKind } from '../lexer/tokens';
import { None, Option, Some } from '../option';
import { extractVariableNode, isExpressionAnIdentifierNode, last } from '../utils';
import NodeFactory from './factory';
import {
  AttributeNode,
  BlockExpressionNode,
  CallExpressionNode,
  ElementDeclarationNode,
  ExpressionNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  GroupExpressionNode,
  IdentiferStreamNode,
  InfixExpressionNode,
  ListExpressionNode,
  LiteralNode,
  NormalExpressionNode,
  PostfixExpressionNode,
  PrefixExpressionNode,
  PrimaryExpressionNode,
  SyntaxNode,
  TupleExpressionNode,
  VariableNode,
} from './nodes';

// Try to interpret a function application as an element
export function convertFuncAppToElem(
  callee: ExpressionNode,
  args: NormalExpressionNode[],
  factory: NodeFactory,
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
      factory.create(ElementDeclarationNode, {
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
      factory.create(ElementDeclarationNode, {
        type,
        name: cpArgs[0],
        attributeList,
        body,
      }),
    );
  }

  if (cpArgs.length === 0) {
    return new Some(
      factory.create(ElementDeclarationNode, {
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

export function markInvalid(nodeOrToken?: SyntaxNode | SyntaxToken) {
  if (!nodeOrToken) {
    return;
  }

  if (nodeOrToken instanceof SyntaxToken) {
    markInvalidToken(nodeOrToken);
  } else {
    markInvalidNode(nodeOrToken);
  }
}

function markInvalidToken(token: SyntaxToken) {
  if (token.kind === SyntaxTokenKind.EOF) {
    return;
  }
  // eslint-disable-next-line no-param-reassign
  token.kind = SyntaxTokenKind.INVALID;
}

function markInvalidNode(node: SyntaxNode) {
  if (node instanceof ElementDeclarationNode) {
    markInvalid(node.type);
    markInvalid(node.name);
    markInvalid(node.as);
    markInvalid(node.alias);
    markInvalid(node.bodyColon);
    markInvalid(node.attributeList);
    markInvalid(node.body);
  } else if (node instanceof IdentiferStreamNode) {
    node.identifiers.forEach(markInvalid);
  } else if (node instanceof AttributeNode) {
    markInvalid(node.name);
    markInvalid(node.colon);
    markInvalid(node.value);
  } else if (node instanceof PrefixExpressionNode) {
    markInvalid(node.op);
    markInvalid(node.expression);
  } else if (node instanceof InfixExpressionNode) {
    markInvalid(node.leftExpression);
    markInvalid(node.op);
    markInvalid(node.rightExpression);
  } else if (node instanceof PostfixExpressionNode) {
    markInvalid(node.op);
    markInvalid(node.expression);
  } else if (node instanceof BlockExpressionNode) {
    markInvalid(node.blockOpenBrace);
    node.body.forEach(markInvalid);
    markInvalid(node.blockCloseBrace);
  } else if (node instanceof ListExpressionNode) {
    markInvalid(node.listOpenBracket);
    node.commaList.forEach(markInvalid);
    node.elementList.forEach(markInvalid);
    markInvalid(node.listCloseBracket);
  } else if (node instanceof TupleExpressionNode) {
    markInvalid(node.tupleOpenParen);
    node.commaList.forEach(markInvalid);
    node.elementList.forEach(markInvalid);
    markInvalid(node.tupleCloseParen);
  } else if (node instanceof CallExpressionNode) {
    markInvalid(node.callee);
    markInvalid(node.argumentList);
  } else if (node instanceof FunctionApplicationNode) {
    markInvalid(node.callee);
    node.args.forEach(markInvalid);
  } else if (node instanceof PrimaryExpressionNode) {
    markInvalid(node.expression);
  } else if (node instanceof FunctionExpressionNode) {
    markInvalid(node.value);
  } else if (node instanceof VariableNode) {
    markInvalid(node.variable);
  } else if (node instanceof LiteralNode) {
    markInvalid(node.literal);
  } else if (node instanceof GroupExpressionNode) {
    throw new Error('This case is handled by the TupleExpressionNode case');
  } else {
    throw new Error('Unreachable case in markInvalidNode');
  }
}

export function isInvalidToken(token?: SyntaxToken): boolean {
  return token?.kind === SyntaxTokenKind.INVALID;
}
