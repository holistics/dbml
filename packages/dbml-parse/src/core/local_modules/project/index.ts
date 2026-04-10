import { ElementKind } from '@/core/types/keywords';
import { isElementNode, isElementFieldNode } from '@/core/utils/expression';
import { type LocalModule, type Settings } from '../types';
import { PASS_THROUGH, type PassThrough } from '@/constants';
import { SyntaxNode } from '@/core/parser/nodes';
import Report from '@/core/types/report';
import type Compiler from '@/compiler';
import ProjectValidator from './validate';

export const projectModule: LocalModule = {
  validate (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Project)) {
      return Report.create(
        undefined,
        new ProjectValidator(compiler, node).validate(),
      );
    }
    return Report.create(PASS_THROUGH);
  },

  fullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Project)) {
      return new ProjectValidator(compiler, node).validateName(node.name);
    }
    if (isElementFieldNode(node, ElementKind.Project)) {
      return new Report(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  alias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Project)) {
      return new ProjectValidator(compiler, node).validateAlias(node.alias);
    }
    if (isElementFieldNode(node, ElementKind.Project)) {
      return new Report(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  settings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Project)) {
      return new ProjectValidator(compiler, node).validateSettingList(node.attributeList);
    }
    if (isElementFieldNode(node, ElementKind.Project)) {
      return new Report({});
    }
    return Report.create(PASS_THROUGH);
  },
};
