import type Compiler from '@/compiler/index';
import type {
  Filepath,
} from '@/core/types/filepath';
import {
  ElementKind, SettingName,
} from '@/core/types/keywords';
import {
  PASS_THROUGH, UNHANDLED, type PassThrough,
} from '@/core/types/module';
import {
  ElementDeclarationNode, FunctionApplicationNode, ProgramNode, type SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  Note,
} from '@/core/types/schemaJson';
import {
  NodeSymbol, NoteSymbol, SymbolKind,
} from '@/core/types/symbol';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import {
  extractQuotedStringToken, getBody, isElementNode,
} from '@/core/utils/expression';
import {
  extractColor, normalizeNote,
} from '@/core/utils/interpret';
import type {
  GlobalModule,
} from '../types';

import NoteBinder from './bind';

export const noteModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Note) || !(node.parentNode instanceof ProgramNode)) {
      return Report.create(PASS_THROUGH);
    }

    return new Report(compiler.symbolFactory.create(NoteSymbol, {
      declaration: node,
      name: compiler.nodeFullname(node).getFiltered(UNHANDLED)?.at(-1),
    }, node.filepath));
  },

  symbolMembers (compiler: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<PassThrough> {
    if (!symbol.isKind(SymbolKind.Note)) {
      return Report.create(PASS_THROUGH);
    }

    return new Report([]);
  },

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Note)) return Report.create(PASS_THROUGH);

    return Report.create(
      undefined,
      new NoteBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind(),
    );
  },

  interpretSymbol (compiler: Compiler, symbol: NodeSymbol, filepath?: Filepath): Report<Note | undefined> | Report<PassThrough> {
    if (!(symbol instanceof NoteSymbol)) return Report.create(PASS_THROUGH);
    if (!(symbol.declaration instanceof ElementDeclarationNode)) return Report.create(undefined);

    const {
      name,
    } = symbol.interpretedName(compiler, filepath);
    const token = symbol.token!;
    const settings = symbol.settings(compiler);
    const headerColor = settings?.[SettingName.HeaderColor]?.length
      ? extractColor(settings[SettingName.HeaderColor].at(0)?.value)
      : undefined;

    const body = getBody(symbol.declaration);
    const field = body[0];
    const content = (field instanceof FunctionApplicationNode)
      ? normalizeNote(extractQuotedStringToken(field.callee) ?? '')
      : '';

    return Report.create({
      name,
      content,
      token,
      headerColor,
    } as Note);
  },
};
