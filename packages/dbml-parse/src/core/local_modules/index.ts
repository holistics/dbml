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
import ChecksValidator from '@/core/local_modules/checks/validate';
import CustomValidator from '@/core/local_modules/custom/validate';
import DiagramViewValidator from '@/core/local_modules/diagramView/validate';
import EnumValidator from '@/core/local_modules/enum/validate';
import IndexesValidator from '@/core/local_modules/indexes/validate';
import NoteValidator from '@/core/local_modules/note/validate';
import ProjectValidator from '@/core/local_modules/project/validate';
import RecordsValidator from '@/core/local_modules/records/validate';
import RefValidator from '@/core/local_modules/ref/validate';
import TableValidator from '@/core/local_modules/table/validate';
import TableGroupValidator from '@/core/local_modules/tableGroup/validate';
import TablePartialValidator from '@/core/local_modules/tablePartial/validate';

export function pickValidator (element: ElementDeclarationNode & { type: SyntaxToken }) {
  switch (convertStringToEnum(ElementKind, element.type.value)) {
    case ElementKind.Enum:
      return EnumValidator;
    case ElementKind.Table:
      return TableValidator;
    case ElementKind.TableGroup:
      return TableGroupValidator;
    case ElementKind.Project:
      return ProjectValidator;
    case ElementKind.Ref:
      return RefValidator;
    case ElementKind.Note:
      return NoteValidator;
    case ElementKind.Indexes:
      return IndexesValidator;
    case ElementKind.TablePartial:
      return TablePartialValidator;
    case ElementKind.Checks:
      return ChecksValidator;
    case ElementKind.Records:
      return RecordsValidator;
    case ElementKind.DiagramView:
      return DiagramViewValidator;
    default:
      return CustomValidator;
  }
}

export function validateNode (this: Compiler, node: SyntaxNode): Report<void> | Report<Unhandled> {
  if (!(node instanceof ElementDeclarationNode) || !node.type) {
    return Report.create(UNHANDLED);
  }

  const program = node.parentNode;
  if (!(program instanceof ProgramNode) || !program.symbol?.symbolTable) {
    return Report.create(UNHANDLED);
  }

  const Val = pickValidator(node as ElementDeclarationNode & { type: SyntaxToken });
  const validator = new Val(
    node as ElementDeclarationNode & { type: SyntaxToken },
    program.symbol.symbolTable,
    this.symbolFactory,
  );
  const result = validator.validate();

  return Report.create(undefined, result.errors, result.warnings);
}
