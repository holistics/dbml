import type Compiler from '@/compiler/index';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  PASS_THROUGH, type PassThrough,
} from '@/core/types/module';
import {
  ElementDeclarationNode,
} from '@/core/types/nodes';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import type {
  GlobalModule,
} from '../types';
import ProjectBinder from './bind';
import {
  isElementNode,
} from '@/core/utils/validate';

export const projectModule: GlobalModule = {
  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Project)) return Report.create(PASS_THROUGH);

    return Report.create(
      undefined,
      new ProjectBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind(),
    );
  },

};
