import { ElementDeclarationNode } from '../../parser/nodes';
import { SyntaxToken } from '../../lexer/tokens';
import { CompileError } from '../../errors';
import { BinderContext } from '@/core/analyzer/analyzer';

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
