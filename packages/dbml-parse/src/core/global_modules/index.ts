import type Compiler from '@/compiler';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  UNHANDLED, type Unhandled,
} from '@/core/types/module';
import {
  ElementDeclarationNode, ProgramNode,
} from '@/core/types/nodes';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import {
  convertStringToEnum,
} from '@/core/utils/enum';
import ChecksBinder from '@/core/global_modules/checks/bind';
import CustomBinder from '@/core/global_modules/custom/bind';
import DiagramViewBinder from '@/core/global_modules/diagramView/bind';
import EnumBinder from '@/core/global_modules/enum/bind';
import IndexesBinder from '@/core/global_modules/indexes/bind';
import NoteBinder from '@/core/global_modules/note/bind';
import ProjectBinder from '@/core/global_modules/project/bind';
import RecordsBinder from '@/core/global_modules/records/bind';
import RefBinder from '@/core/global_modules/ref/bind';
import TableBinder from '@/core/global_modules/table/bind';
import TableGroupBinder from '@/core/global_modules/tableGroup/bind';
import TablePartialBinder from '@/core/global_modules/tablePartial/bind';

export function pickBinder (element: ElementDeclarationNode & { type: SyntaxToken }) {
  switch (convertStringToEnum(ElementKind, element.type.value)) {
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
    case ElementKind.Checks:
      return ChecksBinder;
    case ElementKind.Records:
      return RecordsBinder;
    case ElementKind.DiagramView:
      return DiagramViewBinder;
    default:
      return CustomBinder;
  }
}

export function bindNode (this: Compiler, node: SyntaxNode): Report<void> | Report<Unhandled> {
  if (!(node instanceof ElementDeclarationNode) || !node.type) {
    return Report.create(UNHANDLED);
  }

  const program = node.parentNode;
  if (!(program instanceof ProgramNode)) {
    return Report.create(UNHANDLED);
  }

  const _Binder = pickBinder(node as ElementDeclarationNode & { type: SyntaxToken });
  const binder = new _Binder(
    node as ElementDeclarationNode & { type: SyntaxToken },
    program,
    this.symbolFactory,
  );

  return Report.create(undefined, binder.bind());
}
