import { SyntaxToken } from '../../lexer/tokens';
import { ElementDeclarationNode } from '../../parser/nodes';
import { ElementKind } from '../types';
import CustomBinder from './elementBinder/custom';
import EnumBinder from './elementBinder/enum';
import IndexesBinder from './elementBinder/indexes';
import NoteBinder from './elementBinder/note';
import ProjectBinder from './elementBinder/project';
import RefBinder from './elementBinder/ref';
import TableBinder from './elementBinder/table';
import TableGroupBinder from './elementBinder/tableGroup';

export function pickBinder(element: ElementDeclarationNode & { type: SyntaxToken }) {
  switch (element.type.value.toLowerCase() as ElementKind) {
    case ElementKind.Enum:
      return EnumBinder;
    case ElementKind.Table:
      return TableBinder;
    case ElementKind.TableGroup:
      return TableGroupBinder;
    case ElementKind.Project:
      return ProjectBinder;
    case ElementKind.Ref:
      return RefBinder;
    case ElementKind.Note:
      return NoteBinder;
    case ElementKind.Indexes:
      return IndexesBinder;
    default:
      return CustomBinder;
  }
}
