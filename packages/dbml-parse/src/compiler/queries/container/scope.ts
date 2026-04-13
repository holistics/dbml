import type Compiler from '../../index';
import {
  NodeSymbol,
} from '@/core/types/symbol';
import {
  UNHANDLED,
} from '@/constants';

// @deprecated - returns the members of the element at offset
export function containerScope (this: Compiler, offset: number): NodeSymbol[] | undefined {
  const element = this.container.element(offset);
  if (!element) return undefined;
  const sym = this.nodeSymbol(element);
  if (sym.hasValue(UNHANDLED)) return undefined;
  const members = this.symbolMembers(sym.getValue());
  if (members.hasValue(UNHANDLED)) return undefined;
  return members.getValue();
}
