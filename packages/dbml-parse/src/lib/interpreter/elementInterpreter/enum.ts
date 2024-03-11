import { extractQuotedStringToken, extractVariableFromExpression } from '../../analyzer/utils';
import { aggregateSettingList } from '../../analyzer/validator/utils';
import { CompileError, CompileErrorCode } from '../../errors';
import {
 BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, SyntaxNode,
} from '../../parser/nodes';
import {
 ElementInterpreter, Enum, EnumField, InterpreterDatabase, Table,
} from '../types';
import { extractElementName, getTokenPosition } from '../utils';

export class EnumInterpreter implements ElementInterpreter {
  private declarationNode: ElementDeclarationNode;
  private env: InterpreterDatabase;
  private enum: Partial<Enum>;

  constructor(declarationNode: ElementDeclarationNode, env: InterpreterDatabase) {
    this.declarationNode = declarationNode;
    this.env = env;
    this.enum = { values: [] };
  }

  interpret(): CompileError[] {
    this.enum.token = getTokenPosition(this.declarationNode);
    this.env.enums.set(this.declarationNode, this.enum as Enum);
    const errors = [...this.interpretName(this.declarationNode.name!), ...this.interpretBody(this.declarationNode.body as BlockExpressionNode)];

    return errors;
  }

  private interpretName(nameNode: SyntaxNode): CompileError[] {
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

  private interpretBody(body: BlockExpressionNode): CompileError[] {
    return body.body.flatMap((_field) => {
      const field = _field as FunctionApplicationNode;

      const enumField: Partial<EnumField> = { };

      enumField.token = getTokenPosition(field);
      enumField.name = extractVariableFromExpression(field.callee).unwrap();

      const settingMap = aggregateSettingList(field.args[0] as ListExpressionNode).getValue();
      const noteNode = settingMap.note?.at(0);
      enumField.note = noteNode && {
        value: extractQuotedStringToken(noteNode.value).unwrap(),
        token: getTokenPosition(noteNode),
      };

      this.enum.values!.push(enumField as EnumField);

    return [];
    });
  }
}
