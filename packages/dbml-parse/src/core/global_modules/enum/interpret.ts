import { extractQuotedStringToken, extractVariableFromExpression } from '@/core/utils/expression';
import { aggregateSettingList } from '@/core/utils/validate';
import { CompileError, CompileErrorCode } from '@/core/errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, SyntaxNode,
} from '@/core/parser/nodes';
import type {
  Enum, EnumField,
} from '@/core/types/schemaJson';
import { extractElementName, getTokenPosition, normalizeNoteContent } from '../utils';
import Compiler from '@/compiler';
import Report from '@/core/report';

export default class EnumInterpreter {
  private declarationNode: ElementDeclarationNode;
  private enum: Partial<Enum>;
  private compiler: Compiler;

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode) {
    this.compiler = compiler;
    this.declarationNode = declarationNode;
    this.enum = { values: [] };
  }

  interpret (): Report<Enum> {
    this.enum.token = getTokenPosition(this.declarationNode);
    const errors = [...this.interpretName(this.declarationNode.name!), ...this.interpretBody(this.declarationNode.body as BlockExpressionNode)];

    return Report.create(
      this.enum as Enum,
      errors,
    );
  }

  private interpretName (nameNode: SyntaxNode): CompileError[] {
    const { name, schemaName } = extractElementName(nameNode);

    if (schemaName.length > 1) {
      this.enum.name = name;
      this.enum.schemaName = schemaName.join('.');

      return [new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', nameNode)];
    }

    this.enum.name = name;
    this.enum.schemaName = schemaName.length ? schemaName[0] : null;

    return [];
  }

  private interpretBody (body: BlockExpressionNode): CompileError[] {
    return body.body.flatMap((_field) => {
      const field = _field as FunctionApplicationNode;

      const enumField: Partial<EnumField> = { };

      enumField.token = getTokenPosition(field);
      enumField.name = extractVariableFromExpression(field.callee);

      const settingMap = aggregateSettingList(field.args[0] as ListExpressionNode).getValue();
      const noteNode = settingMap.note?.at(0);
      enumField.note = noteNode && {
        value: normalizeNoteContent(extractQuotedStringToken(noteNode.value)!),
        token: getTokenPosition(noteNode),
      };

      this.enum.values!.push(enumField as EnumField);

      return [];
    });
  }
}
