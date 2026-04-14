import {
  type Filepath,
} from '@/core/types/filepath';
import {
  UNHANDLED,
} from '@/core/types/module';
import {
  NodeSymbol,
} from '@/core/types/symbol';
import type Compiler from '../../index';

// @deprecated - returns the members of the element at offset
export function containerScope (this: Compiler, filepath: Filepath, offset: number): NodeSymbol[] | undefined {
  const element = this.container.element(filepath, offset);
  if (!element) return undefined;
  const sym = this.nodeSymbol(element);
  if (sym.hasValue(UNHANDLED)) return undefined;
  const members = this.symbolMembers(sym.getValue());
  if (members.hasValue(UNHANDLED)) return undefined;
  return members.getValue();
}
