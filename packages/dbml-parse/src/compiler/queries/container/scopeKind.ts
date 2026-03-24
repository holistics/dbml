import type Compiler from '../../index';
import type { Filepath } from '../../projectLayout';
import { ScopeKind } from '../../types';
import { ElementDeclarationNode, ProgramNode } from '@/core/parser/nodes';

export function containerScopeKind (this: Compiler, offset: number, filepath: Filepath): ScopeKind {
  const elem = this.container.element(offset, filepath);

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
    case 'records':
      return ScopeKind.RECORDS;
    default:
      return ScopeKind.CUSTOM;
  }
}
