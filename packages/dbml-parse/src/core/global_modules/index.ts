import type Compiler from '@/compiler';
import {
  pickBinder,
} from '@/core/analyzer/binder/utils';
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

export function bindNode (this: Compiler, node: SyntaxNode): Report<void> | Report<Unhandled> {
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
