import type Compiler from '../../index';
import type { ProgramNode } from '@/core/parser/nodes';

export function ast (this: Compiler): Readonly<ProgramNode> {
  return this.parse._().getValue().ast;
}
