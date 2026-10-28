import { last } from 'lodash-es';
import { SyntaxToken, SyntaxTokenKind } from '@/core/types/tokens';

export const enum ParsingContext {
  ListExpression,
  GroupExpression,
  BlockExpression,
}

export class ParsingContextStack {
  private stack: ParsingContext[] = [];

  private numberOfNestedLParens = 0;

  private numberOfNestedLBrackets = 0;

  private numberOfNestedLBraces = 0;

  push (context: ParsingContext) {
    this.stack.push(context);
    if (context === ParsingContext.ListExpression) {
      this.numberOfNestedLBrackets += 1;
    }
    if (context === ParsingContext.GroupExpression) {
      this.numberOfNestedLParens += 1;
    }
    if (context === ParsingContext.BlockExpression) {
      this.numberOfNestedLBraces += 1;
    }
  }

  pop (): ParsingContext | undefined {
    const top = this.stack.pop();
    if (top === ParsingContext.ListExpression) {
      this.numberOfNestedLBrackets -= 1;
    }
    if (top === ParsingContext.GroupExpression) {
      this.numberOfNestedLParens -= 1;
    }
    if (top === ParsingContext.BlockExpression) {
      this.numberOfNestedLBraces -= 1;
    }

    return top;
  }

  top (): ParsingContext | undefined {
    return last(this.stack);
  }

  isWithinGroupExpressionContext (): boolean {
    return this.numberOfNestedLParens > 0;
  }

  isWithinListExpressionContext (): boolean {
    return this.numberOfNestedLBrackets > 0;
  }

  isWithinBlockExpressionContext (): boolean {
    return this.numberOfNestedLBraces > 0;
  }

  // Call the passed in callback
  // with the guarantee that the passed in context will be pushed and popped properly
  // even in cases of exceptions
  withContextDo<T>(context: ParsingContext, callback: () => T): () => T {
    return () => {
      this.push(context);

      try {
        const result = callback();

        return result;
      } finally {
        this.pop();
      }
    };
  }

  // Return the type of the handler context currently in the context stack to handle `token`
  findHandlerContext (tokens: SyntaxToken[], currentTokenId: number): ParsingContext | undefined {
    if (
      this.numberOfNestedLBraces <= 0
      && this.numberOfNestedLBrackets <= 0
      && this.numberOfNestedLParens <= 0
    ) {
      return undefined;
    }

    for (let tokenId = currentTokenId; tokenId < tokens.length - 1; tokenId += 1) {
      const token = tokens[tokenId];
      switch (token.kind) {
        case SyntaxTokenKind.COMMA:
          if (this.isWithinGroupExpressionContext() || this.isWithinListExpressionContext()) {
            return [
              ...this.stack,
            ]
              .reverse()
              .find((context) => [
                ParsingContext.GroupExpression,
                ParsingContext.ListExpression,
              ].includes(context))!;
          }
          break;
        case SyntaxTokenKind.RPAREN:
          if (this.isWithinGroupExpressionContext()) {
            return ParsingContext.GroupExpression;
          }
          break;
        case SyntaxTokenKind.RBRACE:
          if (this.isWithinBlockExpressionContext()) {
            return ParsingContext.BlockExpression;
          }
          break;
        case SyntaxTokenKind.RBRACKET:
          if (this.isWithinListExpressionContext()) {
            return ParsingContext.ListExpression;
          }
          break;
        default:
          break;
      }
    }

    return undefined;
  }
}
