import { partition } from 'lodash-es';
import type { Note } from '@/core/types/schemaJson';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, SyntaxNode,
} from '@/core/types/nodes';
import {
  extractColor, extractElementName, getTokenPosition, normalizeNoteContent,
} from '../utils';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { aggregateSettingList } from '@/core/utils/validate';
import Compiler from '@/compiler';
import Report from '@/core/types/report';
import { extractQuotedStringToken } from '@/core/utils/expression';
import { SettingName } from '@/core/types/keywords';

export class StickyNoteInterpreter {
  private declarationNode: ElementDeclarationNode;
  private compiler: Compiler;
  private note: Partial<Note>;

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode) {
    this.declarationNode = declarationNode;
    this.compiler = compiler;
    this.note = { name: undefined, content: undefined, token: undefined };
  }

  interpret (): Report<Note> {
    this.note.token = getTokenPosition(this.declarationNode);
    const errors = [
      ...this.interpretName(this.declarationNode.name),
      ...this.interpretSettingList(this.declarationNode.attributeList),
      ...this.interpretBody(this.declarationNode.body as BlockExpressionNode),
    ];

    return new Report(this.note as Note, errors);
  }

  private interpretName (nameNode?: SyntaxNode): CompileError[] {
    if (nameNode) {
      const { name } = extractElementName(nameNode);
      this.note.name = name;
    } else {
      this.note.name = '';
    }

    return [];
  }

  private interpretSettingList (settings?: ListExpressionNode): CompileError[] {
    const settingMap = aggregateSettingList(settings).getValue();

    this.note.headerColor = settingMap[SettingName.HeaderColor]?.length ? extractColor(settingMap[SettingName.HeaderColor]?.at(0)?.value as any) : undefined;

    return [];
  }

  private interpretBody (body: BlockExpressionNode): CompileError[] {
    const [fields, subs] = partition(body.body, (e) => e instanceof FunctionApplicationNode);

    if (fields.length !== 1 || subs.length > 0) {
      return [
        new CompileError(CompileErrorCode.INVALID_NOTE, 'Invalid note syntax', body),
      ];
    }

    return [...this.interpretNote(fields[0] as FunctionApplicationNode)];
  }

  private interpretNote (note: FunctionApplicationNode): CompileError[] {
    const noteContent = extractQuotedStringToken(note.callee) ?? '';

    this.note.content = normalizeNoteContent(noteContent);
    return [];
  }
}
