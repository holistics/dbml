import {
  type Filepath,
} from '@/core/types/filepath';
import {
  ElementDeclarationNode, ProgramNode,
} from '@/core/types/nodes';
import type Compiler from '../../index';
import {
  ScopeKind,
} from '../../types';

export function containerScopeKind (this: Compiler, filepath: Filepath, offset: number): ScopeKind {
  const elem = this.container.element(filepath, offset);

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
    case 'diagramview':
      return ScopeKind.DIAGRAMVIEW;
    default:
      return ScopeKind.CUSTOM;
  }
}
