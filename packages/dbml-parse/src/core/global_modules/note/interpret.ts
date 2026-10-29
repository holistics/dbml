import { omit, partition } from 'lodash-es';
import { aggregateSettingList } from '@/core/utils/validate';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import {
  type BlockExpressionNode,
  type ElementDeclarationNode,
  FunctionApplicationNode,
  type ListExpressionNode,
} from '@/core/types/nodes';
import type { Note } from '@/core/types/schemaJson';
import type Compiler from '@/compiler';
import {
  getTokenPosition,
  normalizeNote,
} from '@/core/utils/interpret';
import { extractQuotedStringToken } from '@/core/utils/expression';
import {
  type Filepath,
  type NoteSymbol,
} from '@/core/types';
import Report from '@/core/types/report';
import { assignInlineMetadata } from '../../utils/interpret';
import { attachCustomMetadata } from '../metadata/utils';
import { NOTE_METADATA_FIELDS } from '../metadata/registries';

const INLINE_LINK_SETTINGS = [
  'link',
  'ref',
];

export class StickyNoteInterpreter {
  private declarationNode: ElementDeclarationNode;
  private symbol: NoteSymbol;
  private compiler: Compiler;
  private filepath: Filepath;
  private note: Partial<Note>;

  constructor (compiler: Compiler, symbol: NoteSymbol, filepath: Filepath) {
    this.compiler = compiler;
    this.symbol = symbol;
    this.declarationNode = symbol.declaration as ElementDeclarationNode;
    this.filepath = filepath;
    this.note = {
      name: undefined,
      content: undefined,
      token: undefined,
    };
  }

  interpret (): Report<Note> {
    this.note.token = getTokenPosition(this.declarationNode);

    const errors = [
      ...this.interpretName(),
      ...this.interpretSettingList(this.declarationNode.attributeList),
      ...this.interpretBody(this.declarationNode.body as BlockExpressionNode | undefined),
    ];

    attachCustomMetadata(this.compiler, this.note, this.symbol, NOTE_METADATA_FIELDS, this.filepath);

    return Report.create(this.note as Note, errors);
  }

  private interpretName (): CompileError[] {
    const {
      name,
    } = this.symbol.interpretedName(this.compiler, this.filepath);

    this.note.name = name;

    return [];
  }

  private interpretSettingList (settings?: ListExpressionNode): CompileError[] {
    const settingMap = aggregateSettingList(settings).getValue();

    // An architecture file's note may carry inline links, which are links, not metadata
    const isArch = this.compiler.parsedFileKind(this.declarationNode.filepath) === 'arch';
    assignInlineMetadata(this.note, isArch ? omit(settingMap, INLINE_LINK_SETTINGS) : settingMap, NOTE_METADATA_FIELDS);

    return [];
  }

  private interpretBody (body?: BlockExpressionNode): CompileError[] {
    // An architecture file allows `Note memo` with no body
    if (!body) {
      this.note.content = '';
      return [];
    }
    const [
      fields,
      subs,
    ] = partition(body.body, (e) => e instanceof FunctionApplicationNode);

    if (fields.length !== 1 || subs.length > 0) {
      return [
        new CompileError(CompileErrorCode.INVALID_NOTE, 'Invalid note syntax', body),
      ];
    }

    return [
      ...this.interpretNote(fields[0] as FunctionApplicationNode),
    ];
  }

  private interpretNote (note: FunctionApplicationNode): CompileError[] {
    const noteContent = extractQuotedStringToken(note.callee) ?? '';

    this.note.content = normalizeNote(noteContent);
    return [];
  }
}
