import type Compiler from '../../index';
import { findLastIndex, last } from 'lodash-es';
import {
  SyntaxNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  PrefixExpressionNode,
  InfixExpressionNode,
  ListExpressionNode,
  TupleExpressionNode,
  BlockExpressionNode,
  IdentiferStreamNode,
} from '@/core/parser/nodes';
import { SyntaxToken, SyntaxTokenKind } from '@/core/lexer/tokens';
import { isOffsetWithinSpan } from '@/core/utils';
import { getMemberChain } from '@/core/parser/utils';

export function containerStack (this: Compiler, offset: number): readonly Readonly<SyntaxNode>[] {
  const tokens = this.token.flatStream();
  const { index: startIndex, token } = this.container.token(offset);
  const validIndex = startIndex === undefined
    ? -1
    : findLastIndex(tokens, (t) => !t.isInvalid, startIndex);

  if (validIndex === -1) {
    return [this.parse.ast()];
  }

  const searchOffset = tokens[validIndex].start;

  let curNode: Readonly<SyntaxNode> = this.parse.ast();
  const res: SyntaxNode[] = [curNode];

  while (true) {
    const memberChain = getMemberChain(curNode);
    const foundMem = memberChain.find((mem) => isOffsetWithinSpan(searchOffset, mem));
    if (foundMem === undefined || foundMem instanceof SyntaxToken) {
      break;
    }
    res.push(foundMem);
    curNode = foundMem;
  }

  if (token?.kind === SyntaxTokenKind.COLON) {
    return res;
  }

  while (res.length > 0) {
    let popOnce = false;
    const lastContainer = last(res)!;

    if (lastContainer instanceof FunctionApplicationNode) {
      const source = this.parse.source();
      for (let i = lastContainer.end; i < offset; i += 1) {
        if (source[i] === '\n') {
          res.pop();
          popOnce = true;
        }
      }
    } else if (
      lastContainer instanceof PrefixExpressionNode
      || lastContainer instanceof InfixExpressionNode
    ) {
      if (this.container.token(offset).token !== lastContainer.op) {
        res.pop();
        popOnce = true;
      }
    } else if (lastContainer instanceof ListExpressionNode) {
      if (lastContainer.listCloseBracket && lastContainer.end <= offset) {
        res.pop();
        popOnce = true;
      }
    } else if (lastContainer instanceof TupleExpressionNode) {
      if (lastContainer.tupleCloseParen && lastContainer.end <= offset) {
        res.pop();
        popOnce = true;
      }
    } else if (lastContainer instanceof BlockExpressionNode) {
      if (lastContainer.blockCloseBrace && lastContainer.end <= offset) {
        res.pop();
        popOnce = true;
      }
    } else if (!(lastContainer instanceof IdentiferStreamNode)) {
      if (lastContainer.end < offset) {
        res.pop();
        popOnce = true;
      }
    }

    if (popOnce) {
      const maybeElement = last(res);
      if (maybeElement instanceof ElementDeclarationNode && maybeElement.end <= offset) {
        res.pop();
      }
    }
    if (!popOnce) {
      break;
    }
  }

  return res;
}
