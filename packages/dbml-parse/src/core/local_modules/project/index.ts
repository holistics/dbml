import type Compiler from '@/compiler';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  PASS_THROUGH, type PassThrough,
} from '@/core/types/module';
import {
  SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import {
  isElementFieldNode, isElementNode,
} from '@/core/utils/expression';
import {
  type LocalModule, type Settings,
} from '../types';
import ProjectValidator from './validate';

export const projectModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Project)) {
      return Report.create(
        undefined,
        new ProjectValidator(compiler, node).validate(),
      );
    }
    return Report.create(PASS_THROUGH);
  },

  nodeFullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Project)) {
      return new ProjectValidator(compiler, node).validateName(node.name);
    }
    if (isElementFieldNode(node, ElementKind.Project)) {
      return new Report(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Project)) {
      return new ProjectValidator(compiler, node).validateAlias(node.alias);
    }
    if (isElementFieldNode(node, ElementKind.Project)) {
      return new Report(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeSettings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Project)) {
      return new ProjectValidator(compiler, node).validateSettingList(node.attributeList);
    }
    if (isElementFieldNode(node, ElementKind.Project)) {
      return new Report({});
    }
    return Report.create(PASS_THROUGH);
  },
};
