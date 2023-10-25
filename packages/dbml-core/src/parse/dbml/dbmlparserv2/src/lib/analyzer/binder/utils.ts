import { SyntaxToken } from '../../lexer/tokens';
import { ElementDeclarationNode } from '../../parser/nodes';
import { ElementKind } from '../validator/types';
import { toElementKind } from '../validator/utils';
import CustomBinder from './elementBinder/custom';
import EnumBinder from './elementBinder/enum';
import IndexesBinder from './elementBinder/indexes';
import NoteBinder from './elementBinder/note';
import ProjectBinder from './elementBinder/project';
import RefBinder from './elementBinder/ref';
import TableBinder from './elementBinder/table';
import TableGroupBinder from './elementBinder/tableGroup';

export function pickBinder(element: ElementDeclarationNode & { type: SyntaxToken }) {
  switch (toElementKind(element.type.value)) {
    case ElementKind.ENUM:
      return EnumBinder;
    case ElementKind.TABLE:
      return TableBinder;
    case ElementKind.TABLEGROUP:
      return TableGroupBinder;
    case ElementKind.PROJECT:
      return ProjectBinder;
    case ElementKind.REF:
      return RefBinder;
    case ElementKind.NOTE:
      return NoteBinder;
    case ElementKind.INDEXES:
      return IndexesBinder;
    default:
      return CustomBinder;
  }
}
