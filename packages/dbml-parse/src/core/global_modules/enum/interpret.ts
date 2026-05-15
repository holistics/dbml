import {
  extractQuotedStringToken,
  extractVariableFromExpression,
} from '@/core/utils/expression';
import { aggregateSettingList } from '@/core/utils/validate';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import type {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  ListExpressionNode,
  SyntaxNode,
} from '@/core/types/nodes';
import type {
  Enum,
  EnumField,
} from '@/core/types/schemaJson';
import type {
  EnumSymbol,
  Filepath,
} from '@/core/types';
import type Compiler from '@/compiler';
import {
  getTokenPosition,
  normalizeNote,
} from '@/core/utils/interpret';
import Report from '@/core/types/report';

export class EnumInterpreter {
  private compiler: Compiler;
  private symbol: EnumSymbol;
  private declarationNode: ElementDeclarationNode;
  private enum: Partial<Enum>;
  private filepath: Filepath;

  constructor (compiler: Compiler, symbol: EnumSymbol, filepath: Filepath) {
    this.compiler = compiler;
    this.declarationNode = symbol.declaration as ElementDeclarationNode;
    this.symbol = symbol;
    this.filepath = filepath;
    this.enum = {
      values: [],
    };
  }

  interpret (): Report<Enum> {
    this.enum.token = getTokenPosition(this.declarationNode);
    const errors = [
      ...this.interpretName(),
      ...this.interpretBody(this.declarationNode.body as BlockExpressionNode),
    ];

    return Report.create(this.enum as Enum, errors);
  }

  private interpretName (): CompileError[] {
    const {
      name, schema,
    } = this.symbol.interpretedName(this.compiler, this.filepath);

    this.enum.name = name;
    this.enum.schemaName = schema;

    return [];
  }

  private interpretBody (body: BlockExpressionNode): CompileError[] {
    return body.body.flatMap((_field) => {
      const field = _field as FunctionApplicationNode;

      const enumField: Partial<EnumField> = { };

      enumField.token = getTokenPosition(field);
      enumField.name = extractVariableFromExpression(field.callee)!;

      const settingMap = aggregateSettingList(field.args[0] as ListExpressionNode).getValue();
      const noteNode = settingMap.note?.at(0);
      enumField.note = noteNode && {
        value: normalizeNote(extractQuotedStringToken(noteNode.value)!),
        token: getTokenPosition(noteNode),
      };

      this.enum.values!.push(enumField as EnumField);

      return [];
    });
  }
}
