import {
  findLastIndex, last,
} from 'lodash-es';
import {
  type Filepath,
} from '@/core/types/filepath';
import {
  getMemberChain,
} from '@/core/parser/utils';
import {
  BlockExpressionNode,
  CommaExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  IdentiferStreamNode,
  InfixExpressionNode,
  ListExpressionNode,
  PrefixExpressionNode,
  SyntaxNode,
  TupleExpressionNode,
} from '@/core/types/nodes';
import {
  SyntaxToken, SyntaxTokenKind,
} from '@/core/types/tokens';
import {
  isOffsetWithinSpan,
} from '@/core/utils/span';
import type Compiler from '../../index';

export function containerStack (
  this: Compiler,
  filepath: Filepath,
  offset: number,
): readonly Readonly<SyntaxNode>[] {
  const tokens = this.token.flatStream(filepath);
  const {
    index: startIndex, token,
  } = this.container.token(filepath, offset);
  const validIndex = startIndex === undefined
    ? -1
    : findLastIndex(tokens, (t) => !t.isInvalid, startIndex);

  if (validIndex === -1) {
    return [
      this.parse.ast(filepath),
    ];
  }

  const searchOffset = tokens[validIndex].start;

  let curNode: Readonly<SyntaxNode> = this.parse.ast(filepath);
  const res: SyntaxNode[] = [
    curNode,
  ];

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
      const source = this.parse.source(filepath);
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
      if (this.container.token(filepath, offset).token !== lastContainer.op) {
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
    } else if (lastContainer instanceof CommaExpressionNode) {
      // CommaExpressionNode has no closing delimiter, so pop when offset is past its end
      if (lastContainer.end <= offset) {
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
