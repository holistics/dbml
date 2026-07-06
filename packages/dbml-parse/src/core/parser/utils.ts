import { last } from 'lodash-es';
import NodeFactory from '@/core/parser/factory';
import {
  ArrayNode,
  AttributeNode,
  BlockExpressionNode,
  CallExpressionNode,
  CommaExpressionNode,
  ElementDeclarationNode,
  EmptyNode,
  ExpressionNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  GroupExpressionNode,
  IdentifierStreamNode,
  InfixExpressionNode,
  ListExpressionNode,
  LiteralNode,
  NormalExpressionNode,
  PostfixExpressionNode,
  PrefixExpressionNode,
  PrimaryExpressionNode,
  ProgramNode,
  SyntaxNode,
  TupleExpressionNode,
  UseDeclarationNode,
  UseSpecifierListNode,
  UseSpecifierNode,
  VariableNode,
  WildcardNode,
} from '@/core/types/nodes';
import { SyntaxToken, SyntaxTokenKind } from '@/core/types/tokens';
import { isAsKeyword } from '../utils/tokens';
import { extractVariableNode } from '../utils/expression';
import { isExpressionAnIdentifierNode } from '../utils/validate';

// Try to interpret a function application as an element
export function convertFuncAppToElem (
  _callee: ExpressionNode | CommaExpressionNode | undefined,
  _args: (NormalExpressionNode | CommaExpressionNode)[],
  factory: NodeFactory,
): ElementDeclarationNode | undefined {
  let args = _args;
  let callee = _callee;
  // Handle the case:
  // Table T {
  //   records () // --> call expression here
  // }
  if (callee instanceof CallExpressionNode && callee.argumentList) {
    args = [
      callee.argumentList,
      ...args,
    ];
    callee = callee.callee;
  }
  if (!callee || !isExpressionAnIdentifierNode(callee) || args.length === 0) {
    return undefined;
  }
  const cpArgs = [
    ...args,
  ];

  const type = extractVariableNode(callee)!;

  const body = cpArgs.pop();
  if (!(body instanceof BlockExpressionNode)) {
    return undefined;
  }

  const attributeList = last(cpArgs) instanceof ListExpressionNode
    ? (cpArgs.pop() as ListExpressionNode)
    : undefined;

  if (cpArgs.length === 3) {
    const asKeywordNode = extractVariableNode(cpArgs[1]);
    // If cpArgs = [sth, 'as', sth] then it's a valid element declaration
    return (!asKeywordNode || !isAsKeyword(asKeywordNode))
      ? undefined
      : factory.create(ElementDeclarationNode, {
          type,
          name: cpArgs[0],
          as: asKeywordNode,
          alias: cpArgs[2],
          attributeList,
          body,
        });
  }

  if (cpArgs.length === 1) {
    return factory.create(ElementDeclarationNode, {
      type,
      name: cpArgs[0],
      attributeList,
      body,
    });
  }

  if (cpArgs.length === 0) {
    return factory.create(ElementDeclarationNode, {
      type,
      attributeList,
      body,
    });
  }

  return undefined;
}

export function markInvalid (nodeOrToken?: SyntaxNode | SyntaxToken) {
  if (!nodeOrToken) {
    return;
  }

  if (nodeOrToken instanceof SyntaxToken) {
    markInvalidToken(nodeOrToken);
  } else {
    markInvalidNode(nodeOrToken);
  }
}

function markInvalidToken (token: SyntaxToken) {
  if (token.kind === SyntaxTokenKind.EOF) {
    return;
  }

  token.isInvalid = true;
}

function markInvalidNode (node: SyntaxNode) {
  if (node instanceof ElementDeclarationNode) {
    markInvalid(node.type);
    markInvalid(node.name);
    markInvalid(node.as);
    markInvalid(node.alias);
    markInvalid(node.bodyColon);
    markInvalid(node.attributeList);
    markInvalid(node.body);
  } else if (node instanceof IdentifierStreamNode) {
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
  } else if (node instanceof CommaExpressionNode) {
    node.commaList.forEach(markInvalid);
    node.elementList.forEach(markInvalid);
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
  } else if (node instanceof ArrayNode) {
    markInvalid(node.array);
    markInvalid(node.indexer);
  } else if (node instanceof ProgramNode) {
    node.body.forEach(markInvalid);
    markInvalid(node.eof);
  } else if (node instanceof EmptyNode) {
    // DummyNode has no children to mark invalid
  } else if (node instanceof UseDeclarationNode) {
    markInvalid(node.useKeyword);
    markInvalid(node.specifiers);
    markInvalid(node.fromKeyword);
    markInvalid(node.importPath);
  } else if (node instanceof UseSpecifierListNode) {
    markInvalid(node.openBrace);
    node.specifiers.forEach(markInvalid);
    markInvalid(node.closeBrace);
  } else if (node instanceof UseSpecifierNode) {
    markInvalid(node.importKind);
    markInvalid(node.name);
    markInvalid(node.asKeyword);
    markInvalid(node.alias);
  } else if (node instanceof WildcardNode) {
    markInvalid(node.token);
  } else {
    throw new Error('Unreachable case in markInvalidNode');
  }
}

function filterUndefined (
  ...args: (SyntaxNode | SyntaxToken | undefined)[]
): (SyntaxNode | SyntaxToken)[] {
  return args.filter((v) => v !== undefined) as (SyntaxNode | SyntaxToken)[];
}

export function getMemberChain (node: SyntaxNode): Readonly<(SyntaxNode | SyntaxToken)[]> {
  if (node instanceof ProgramNode) {
    return filterUndefined(...node.body, node.eof);
  }

  if (node instanceof ElementDeclarationNode) {
    return filterUndefined(
      node.type,
      node.name,
      node.as,
      node.alias,
      node.attributeList,
      node.bodyColon,
      node.body,
    );
  }

  if (node instanceof AttributeNode) {
    return filterUndefined(node.name, node.colon, node.value);
  }

  if (node instanceof IdentifierStreamNode) {
    return node.identifiers;
  }

  if (node instanceof LiteralNode) {
    return node.literal
      ? [
          node.literal,
        ]
      : [];
  }

  if (node instanceof VariableNode) {
    return filterUndefined(node.variable);
  }

  if (node instanceof PrefixExpressionNode) {
    return filterUndefined(node.op, node.expression);
  }

  if (node instanceof InfixExpressionNode) {
    return filterUndefined(node.leftExpression, node.op, node.rightExpression);
  }

  if (node instanceof PostfixExpressionNode) {
    return filterUndefined(node.expression, node.op);
  }

  if (node instanceof FunctionExpressionNode) {
    return filterUndefined(node.value);
  }

  if (node instanceof FunctionApplicationNode) {
    return filterUndefined(node.callee, ...node.args);
  }

  if (node instanceof BlockExpressionNode) {
    return filterUndefined(node.blockOpenBrace, ...node.body, node.blockCloseBrace);
  }

  if (node instanceof ListExpressionNode) {
    return filterUndefined(
      node.listOpenBracket,
      ...alternateLists(node.elementList, node.commaList),
      node.listCloseBracket,
    );
  }

  if (node instanceof TupleExpressionNode) {
    return filterUndefined(
      node.tupleOpenParen,
      ...alternateLists(node.elementList, node.commaList),
      node.tupleCloseParen,
    );
  }

  if (node instanceof CommaExpressionNode) {
    return filterUndefined(
      ...alternateLists(node.elementList, node.commaList),
    );
  }

  if (node instanceof CallExpressionNode) {
    return filterUndefined(node.callee, node.argumentList);
  }

  if (node instanceof PrimaryExpressionNode) {
    return filterUndefined(node.expression);
  }

  if (node instanceof ArrayNode) {
    return filterUndefined(
      node.array,
      node.indexer,
    );
  }

  if (node instanceof EmptyNode) {
    return [];
  }

  if (node instanceof UseDeclarationNode) {
    return filterUndefined(node.useKeyword, node.specifiers, node.fromKeyword, node.importPath);
  }

  if (node instanceof UseSpecifierListNode) {
    return filterUndefined(node.openBrace, ...node.specifiers, node.closeBrace);
  }

  if (node instanceof UseSpecifierNode) {
    return filterUndefined(node.importKind, node.name, node.asKeyword, node.alias);
  }

  if (node instanceof WildcardNode) {
    return filterUndefined(node.token);
  }

  if (node instanceof GroupExpressionNode) {
    throw new Error('This case is already handled by TupleExpressionNode');
  }

  throw new Error('Unreachable - no other possible cases');
}

function alternateLists<T, S> (firstList: T[], secondList: S[]): (T | S)[] {
  const res: (T | S)[] = [];
  const minLength = Math.min(firstList.length, secondList.length);
  for (let i = 0; i < minLength; i += 1) {
    res.push(firstList[i], secondList[i]);
  }
  res.push(...firstList.slice(minLength), ...secondList.slice(minLength));

  return res;
}
