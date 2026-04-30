import Binder from '@/core/global_modules/program/bind';
import {
  pickBinder,
} from '@/core/global_modules/utils';
import type {
  Filepath,
} from '@/core/types/filepath';
import {
  UNHANDLED, type Unhandled,
} from '@/core/types/module';
import {
  ElementDeclarationNode, ProgramNode,
} from '@/core/types/nodes';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import type Compiler from '../../index';

export function bindFile (this: Compiler, filepath: Filepath): Report<ProgramNode> {
  return this.validateFile(filepath).chain((program) =>
    new Binder(program, this.symbolFactory).resolve(),
  );
}

export function bindNode (this: Compiler, node: SyntaxNode): Report<void> | Report<Unhandled> {
  if (node instanceof ProgramNode) {
    return new Binder(node, this.symbolFactory).resolve().map(() => undefined);
  }

  if (!(node instanceof ElementDeclarationNode) || !node.type) {
    return Report.create(UNHANDLED);
  }

  const program = node.parentNode;
  if (!(program instanceof ProgramNode)) {
    return Report.create(UNHANDLED);
  }

  const _Binder = pickBinder(node as ElementDeclarationNode & { type: SyntaxToken });
  const binder = new _Binder(
    node as ElementDeclarationNode & { type: SyntaxToken },
    program,
    this.symbolFactory,
  );

  return Report.create(undefined, binder.bind());
}
