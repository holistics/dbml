import { isElementNode } from '@/core/utils/expression';
import { ElementKind } from '@/core/types/keywords';
import { ElementDeclarationNode } from '@/core/parser/nodes';
import type { SyntaxNode } from '@/core/parser/nodes';
import type { SyntaxToken } from '@/core/lexer/tokens';
import type { GlobalModule } from '../types';
import { PASS_THROUGH, type PassThrough } from '@/constants';
import Report from '@/core/types/report';
import type Compiler from '@/compiler/index';
import type { SchemaElement } from '@/core/types/schemaJson';
import { shouldInterpretNode } from '../utils';
import ProjectBinder from './bind';
import { ProjectInterpreter } from './interpret';

export const projectModule: GlobalModule = {
  bind (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Project)) return Report.create(PASS_THROUGH);

    return Report.create(
      undefined,
      new ProjectBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind(),
    );
  },

  interpret (compiler: Compiler, node: SyntaxNode): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Project)) return Report.create(PASS_THROUGH);

    if (!shouldInterpretNode(compiler, node)) return Report.create(undefined);

    return new ProjectInterpreter(compiler, node).interpret();
  },
};
