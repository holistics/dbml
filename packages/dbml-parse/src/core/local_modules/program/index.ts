import { isProgramNode } from '@/core/utils/expression';
import type { SyntaxNode, ProgramNode } from '@/core/types/nodes';
import { type LocalModule } from '../types';
import { PASS_THROUGH, type PassThrough } from '@/constants';
import Report from '@/core/types/report';
import type Compiler from '@/compiler';
import ProgramValidator from './validate';
import { Settings } from '@/core/utils/validate';

export const programModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isProgramNode(node)) return Report.create(PASS_THROUGH);
    return Report.create(undefined, new ProgramValidator(node as ProgramNode, compiler).validate().getErrors());
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
