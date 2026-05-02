import type Compiler from '@/compiler';
import {
  PASS_THROUGH, type PassThrough,
} from '@/core/types/module';
import type {
  ProgramNode, SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import {
  isProgramNode,
  Settings,
} from '@/core/utils/validate';
import {
  type LocalModule,
} from '../types';
import ProgramValidator from './validate';

export const programModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isProgramNode(node)) return Report.create(PASS_THROUGH);
    return Report.create(undefined, new ProgramValidator(compiler, node as ProgramNode).validate().getErrors());
  },

  nodeFullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (!isProgramNode(node)) return Report.create(PASS_THROUGH);
    return new Report(undefined);
  },

  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (!isProgramNode(node)) return Report.create(PASS_THROUGH);
    return new Report(undefined);
  },

  nodeSettings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (!isProgramNode(node)) return Report.create(PASS_THROUGH);
    return new Report({});
  },
};
