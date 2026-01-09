import type Compiler from '../../index';
import { ScopeKind } from '../../types';
import { ElementDeclarationNode, ProgramNode } from '@/core/parser/nodes';

export function containerScopeKind (this: Compiler, offset: number): ScopeKind {
  const elem = this.container.element(offset);

  if (elem instanceof ProgramNode) {
    return ScopeKind.TOPLEVEL;
  }

  switch ((elem as ElementDeclarationNode).type?.value.toLowerCase()) {
    case 'table':
      return ScopeKind.TABLE;
    case 'enum':
      return ScopeKind.ENUM;
    case 'ref':
      return ScopeKind.REF;
    case 'tablegroup':
      return ScopeKind.TABLEGROUP;
    case 'indexes':
      return ScopeKind.INDEXES;
    case 'note':
      return ScopeKind.NOTE;
    case 'project':
      return ScopeKind.PROJECT;
    case 'tablepartial':
      return ScopeKind.TABLEPARTIAL;
    case 'checks':
      return ScopeKind.CHECKS;
    default:
      return ScopeKind.CUSTOM;
  }
}
