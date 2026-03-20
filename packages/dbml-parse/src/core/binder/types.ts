import { ElementDeclarationNode } from '@/core/parser/nodes';
import { SyntaxToken } from '@/core/lexer/tokens';
import { CompileError } from '@/core/errors';
import { BinderContext } from '@/core/types';

export interface ElementBinderArgs {
  declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  context: BinderContext;
}

export interface ElementBinderResult {
  errors: CompileError[];
}

export interface ElementBinder {
  bind(): ElementBinderResult;
}
