import { CompileError } from '../errors';
import { SyntaxToken, SyntaxTokenKind } from '../lexer/tokens';

// Represent a message indicating how many context jumps should be taken
// in order to reach the handler context
class ContextJumpMessage {
  offset: number;

  constructor(offset: number) {
    if (offset < 0) {
      throw new Error("A context jump message with a negative offset shouldn't be thrown");
    }
    this.offset = offset;
  }

  goToOuterContext(): never {
    throw new ContextJumpMessage(this.offset - 1);
  }
}

export const enum ParsingContext {
  ListExpression,
  GroupExpression,
  BlockExpression,
}

function canHandle(context: ParsingContext, token: SyntaxToken): boolean {
  const tokenKind = token.kind;
  switch (context) {
    case ParsingContext.ListExpression:
      return tokenKind === SyntaxTokenKind.RBRACKET || tokenKind === SyntaxTokenKind.COMMA;
    case ParsingContext.GroupExpression:
      return tokenKind === SyntaxTokenKind.RPAREN || tokenKind === SyntaxTokenKind.COMMA;
    case ParsingContext.BlockExpression:
      return tokenKind === SyntaxTokenKind.RBRACE;
  }

  return false;
}

export type SynchronizeHook = (mayThrow: () => void, synchronizationCallback: () => void) => void;
export class ParsingContextStack {
  private stack: ParsingContext[] = [];

  private numberOfNestedLParens = 0;

  private numberOfNestedLBrackets = 0;

  private numberOfNestedLBraces = 0;

  push(ctx: ParsingContext) {
    this.stack.push(ctx);
    if (ctx === ParsingContext.ListExpression) {
      this.numberOfNestedLBrackets += 1;
    }
    if (ctx === ParsingContext.GroupExpression) {
      this.numberOfNestedLParens += 1;
    }
    if (ctx === ParsingContext.BlockExpression) {
      this.numberOfNestedLBraces += 1;
    }
  }

  pop(): ParsingContext | undefined {
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

  isWithinGroupExpressionContext(): boolean {
    return this.numberOfNestedLParens > 0;
  }

  isWithinListExpressionContext(): boolean {
    return this.numberOfNestedLBrackets > 0;
  }

  // Call the passed in callback
  // with the guarantee that the passed in context will be pushed and popped properly
  // even in cases of exceptions
  // The callback is also passed the `synchronizeHook` callback
  // so that the callback can specify at which point to perform synchronization
  // in case of parsing errors
  withContextDo<T>(
    context: ParsingContext | undefined,
    callback: (synchronizeHook: SynchronizeHook) => T,
  ): () => T {
    return () => {
      // The context could be `undefined`
      // This is useful for parsing nodes that do not add any relevant contexts
      if (context !== undefined) {
        this.push(context);
      }

      try {
        const res = callback(this.synchronizeHook);

        return res;
      } catch (e) {
        // Rethrow if the exception is not ContextJumpMessage
        // If the exception is a CompileError, it may be an indication that
        // a function forgets to guard some parsing code with `synchronizeHook`
        if (!(e instanceof ContextJumpMessage)) {
          throw e;
        }
        // If a ContextJumpMessage was thrown, rethrow a new ContextJumpMessage
        // with offset minused by 1

        return e.goToOuterContext() as any;
      } finally {
        if (context !== undefined) {
          this.pop();
        }
      }
    };
  }

  // Return an offset from the current context to the handler context
  findHandlerContextOffset(token: SyntaxToken): number {
    if (
      token.kind === SyntaxTokenKind.COMMA &&
      this.numberOfNestedLBrackets <= 0 &&
      this.numberOfNestedLParens <= 0
    ) {
      return 0;
    }
    if (token.kind === SyntaxTokenKind.RBRACKET && this.numberOfNestedLBrackets <= 0) return 0;
    if (token.kind === SyntaxTokenKind.RPAREN && this.numberOfNestedLParens <= 0) return 0;
    if (token.kind === SyntaxTokenKind.RBRACE && this.numberOfNestedLBraces <= 0) return 0;
    for (let i = this.stack.length - 1; i >= 0; i -= 1) {
      if (canHandle(this.stack[i], token)) {
        return this.stack.length - i - 1;
      }
    }

    return 0;
  }

  // Generate a ContextJumpMessage in order to reach the handler context
  goToHandlerContext(token: SyntaxToken) {
    const offset = this.findHandlerContextOffset(token);
    if (offset === 0) {
      return;
    }

    throw new ContextJumpMessage(offset);
  }

  // Call the passed-in callback that potentially throws
  // If the callback indeed throws a CompileError,
  // find the context capable of handling the invalid token
  // If the current context is the one capable,
  // call the passed-in synchronization callback
  // If the callback throws a ContextJumpMessage with offset 0,
  // also call the passed-in synchronization callback
  // If the offset > 0,
  // simply rethrow it, which will eventually be caught by the current context's `withContextDo`
  synchronizeHook = (mayThrow: () => void, synchronizationCallback: () => void) => {
    try {
      mayThrow();
    } catch (e) {
      if (e instanceof CompileError && e.isTokenError()) {
        this.goToHandlerContext(e.nodeOrToken);
        synchronizationCallback();
      } else if (e instanceof ContextJumpMessage && e.offset === 0) {
        synchronizationCallback();
      } else {
        throw e;
      }
    }
  };
}
