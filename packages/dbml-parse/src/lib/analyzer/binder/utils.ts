import { SyntaxToken } from '@/lib/lexer/tokens';
import { ElementDeclarationNode } from '@/lib/parser/nodes';
import { ElementKind } from '@/lib/analyzer/types';
import ChecksBinder from './elementBinder/checks';
import CustomBinder from './elementBinder/custom';
import EnumBinder from './elementBinder/enum';
import IndexesBinder from './elementBinder/indexes';
import NoteBinder from './elementBinder/note';
import ProjectBinder from './elementBinder/project';
import RefBinder from './elementBinder/ref';
import TableBinder from './elementBinder/table';
import TableGroupBinder from './elementBinder/tableGroup';
import TablePartialBinder from './elementBinder/tablePartial';

export function pickBinder (element: ElementDeclarationNode & { type: SyntaxToken }) {
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
    case ElementKind.TablePartial:
      return TablePartialBinder;
    case ElementKind.Check:
      return ChecksBinder;
    default:
      return CustomBinder;
  }
}
