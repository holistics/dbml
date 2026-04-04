import { isProgramNode } from '@/core/utils/expression';
import type { SyntaxNode, ProgramNode } from '@/core/parser/nodes';
import { type LocalModule } from '../types';
import { PASS_THROUGH, type PassThrough } from '@/constants';
import Report from '@/core/report';
import type Compiler from '@/compiler';
import ProgramValidator from './validate';
import { Settings } from '@/core/utils/validate';

export const programModule: LocalModule = {
  validate (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isProgramNode(node)) return Report.create(PASS_THROUGH);
    return Report.create(undefined, new ProgramValidator(node as ProgramNode, compiler).validate().getErrors());
  },

  fullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (!isProgramNode(node)) return Report.create(PASS_THROUGH);
    return new Report(undefined);
  },

  alias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (!isProgramNode(node)) return Report.create(PASS_THROUGH);
    return new Report(undefined);
  },

  settings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (!isProgramNode(node)) return Report.create(PASS_THROUGH);
    return new Report({});
  },
};
