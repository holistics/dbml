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
import {
  type Filepath,
  type NodeMetadata,
  type Project,
  ProjectMetadata,
} from '@/core/types';
import {
  ProjectInterpreter,
} from './interpret';

export const projectModule: GlobalModule = {
  nodeMetadata (compiler: Compiler, node: SyntaxNode): Report<NodeMetadata> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Project)) return Report.create(PASS_THROUGH);

    return Report.create(new ProjectMetadata(node));
  },

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Project)) return Report.create(PASS_THROUGH);

    return Report.create(
      undefined,
      new ProjectBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind(),
    );
  },

  interpretMetadata (compiler: Compiler, metadata: NodeMetadata, filepath: Filepath): Report<Project> | Report<PassThrough> {
    if (!(metadata instanceof ProjectMetadata) || !(metadata.declaration instanceof ElementDeclarationNode)) {
      return Report.create(PASS_THROUGH);
    }
    return new ProjectInterpreter(compiler, metadata.declaration, filepath).interpret();
  },
};
