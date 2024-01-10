import { SyntaxToken } from '../../lexer/tokens';
import { ElementDeclarationNode } from '../../parser/nodes';
import CustomBinder from './elementBinder/custom';
import EnumBinder from './elementBinder/enum';
import IndexesBinder from './elementBinder/indexes';
import NoteBinder from './elementBinder/note';
import ProjectBinder from './elementBinder/project';
import RefBinder from './elementBinder/ref';
import TableBinder from './elementBinder/table';
import TableGroupBinder from './elementBinder/tableGroup';

export function pickBinder(element: ElementDeclarationNode & { type: SyntaxToken }) {
  switch (element.type.value.toLowerCase()) {
    case 'enum':
      return EnumBinder;
    case 'table':
      return TableBinder;
    case 'tablegroup':
      return TableGroupBinder;
    case 'project':
      return ProjectBinder;
    case 'ref':
      return RefBinder;
    case 'note':
      return NoteBinder;
    case 'indexes':
      return IndexesBinder;
    default:
      return CustomBinder;
  }
}
