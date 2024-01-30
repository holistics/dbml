import { ElementInterpreter, InterpreterDatabase, Note } from '../types';
import { BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, SyntaxNode } from '../../parser/nodes';
import { extractColor, extractElementName, getTokenPosition } from '../utils';
import { CompileError, CompileErrorCode } from '../../errors';
import { aggregateSettingList } from '../../analyzer/validator/utils';
import _ from 'lodash';

export class NoteInterpreter implements ElementInterpreter {
  private declarationNode: ElementDeclarationNode;
  private env: InterpreterDatabase;
  private note: Partial<Note>;

  constructor(declarationNode: ElementDeclarationNode, env: InterpreterDatabase) {
    this.declarationNode = declarationNode;
    this.env = env;
    this.note = { name: undefined, content: undefined, token: undefined };
  }

  interpret(): CompileError[] {
    this.note.token = getTokenPosition(this.declarationNode);
    this.env.notes.set(this.declarationNode, this.note as Note);

    const errors = [
      ...this.interpretName(this.declarationNode.name!),
      ...this.interpretSettingList(this.declarationNode.attributeList),
      ...this.interpretBody(this.declarationNode.body as BlockExpressionNode),
    ];

    return errors;
  }

  private interpretName(nameNode: SyntaxNode): CompileError[] {
    const { name } = extractElementName(nameNode);

    this.note.name = name;

    return [];
  }

  private interpretSettingList(settings?: ListExpressionNode): CompileError[] {
    const settingMap = aggregateSettingList(settings).getValue();

    this.note.headerColor = settingMap['headercolor']?.length ? extractColor(settingMap['headercolor']?.at(0)?.value as any) : undefined;

    return [];
  }

  private interpretBody(body: BlockExpressionNode): CompileError[] {
    const [fields, subs] = _.partition(body.body, (e) => e instanceof FunctionApplicationNode);

    if (fields.length !== 1 || subs.length > 0) {
      return [
        new CompileError(CompileErrorCode.INVALID_NOTE, 'Invalid note syntax', body),
      ]
    }

    return [...this.interpretNote(fields[0] as FunctionApplicationNode)];
  }


  private interpretNote(note: FunctionApplicationNode): CompileError[] {
    const noteContent = _.get(note, 'callee.expression.literal.value', '');

    this.note.content = noteContent;
    return [];
  }
}
