import { partition } from 'lodash-es';
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
  extractColor,
  getTokenPosition,
  normalizeNote,
} from '@/core/utils/interpret';
import { extractQuotedStringToken } from '@/core/utils/expression';
import {
  SettingName,
  type Filepath,
  type NoteSymbol,
} from '@/core/types';
import type { Color } from '@/core/types/schemaJson';
import type { MetadataFieldRegistry } from '@/core/global_modules/metadata/metadataField';
import { isValidColorOrNone } from '@/core/utils/validate';
import Report from '@/core/types/report';
import { extractCustomInlineMetadata } from '../../utils/interpret';

// Per-kind registry for Note (sticky): validate + assign bundled per promotable setting.
// Note color allows 'none' (isValidColorOrNone), unlike TableGroup which is hex-only.
// Defined before the class so the class method can reference it.
export const NOTE_METADATA_FIELDS: MetadataFieldRegistry<Note, SettingName.Color> = {
  [SettingName.Color]: {
    validate: isValidColorOrNone,
    message: "'color' must be a color literal or 'none'",
    assign (element, value) {
      element.color = value as Color;
    },
  },
};

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
      ...this.interpretBody(this.declarationNode.body as BlockExpressionNode),
    ];

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

    if (settingMap.color?.length) {
      this.note.color = extractColor(settingMap.color.at(0)?.value);
    }

    this.note.metadata = extractCustomInlineMetadata(settingMap, Object.keys(NOTE_METADATA_FIELDS) as SettingName[]);

    return [];
  }

  private interpretBody (body: BlockExpressionNode): CompileError[] {
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
