import type Compiler from '@/compiler/index';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import type {
  Filepath,
} from '@/core/types/filepath';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  PASS_THROUGH, type PassThrough, UNHANDLED,
} from '@/core/types/module';
import {
  ElementDeclarationNode,
} from '@/core/types/nodes';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  Enum, SchemaElement,
} from '@/core/types/schemaJson';
import {
  EnumFieldSymbol, EnumSymbol, NodeSymbol, SymbolKind,
} from '@/core/types/symbol';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import {
  extractQuotedStringToken, getBody,
} from '@/core/utils/expression';
import {
  isElementFieldNode, isElementNode,
} from '@/core/utils/validate';
import type {
  GlobalModule,
} from '../types';
import {
  getTokenPosition, normalizeNote,
} from '@/core/utils/interpret';
import EnumBinder from './bind';

// Public utils that other modules can use
export const enumUtils = {
  getDuplicateError (name: string, schemaLabel: string, errorNode: SyntaxNode): CompileError {
    return new CompileError(CompileErrorCode.DUPLICATE_NAME, `Enum '${name}' already exists in schema '${schemaLabel}'`, errorNode);
  },
  getFieldDuplicateError (name: string, errorNode: SyntaxNode): CompileError {
    return new CompileError(CompileErrorCode.DUPLICATE_COLUMN_NAME, `Duplicate enum field '${name}'`, errorNode);
  },
};

export const enumModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    const name = compiler.nodeFullname(node).getFiltered(UNHANDLED)?.at(-1);
    if (isElementNode(node, ElementKind.Enum)) {
      return new Report(compiler.symbolFactory.create(EnumSymbol, {
        declaration: node,
        name,
      }, node.filepath));
    }
    if (isElementFieldNode(node, ElementKind.Enum)) {
      return new Report(compiler.symbolFactory.create(EnumFieldSymbol, {
        declaration: node,
        name,
      }, node.filepath));
    }
    return Report.create(PASS_THROUGH);
  },

  symbolMembers (compiler: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<PassThrough> {
    if (!symbol.isKind(SymbolKind.Enum)) {
      return Report.create(PASS_THROUGH);
    }

    const node = symbol.declaration;
    if (!(node instanceof ElementDeclarationNode)) return new Report([]);
    const children = getBody(node);

    const members: NodeSymbol[] = [];
    const errors: CompileError[] = [];
    for (const child of children) {
      const res = compiler.nodeSymbol(child);
      const symbol = res.getFiltered(UNHANDLED);
      if (!symbol) continue;
      members.push(symbol);
      errors.push(...res.getErrors());
    }

    // Duplicate checking
    const seen = new Map<string, SyntaxNode>();
    for (const member of members) {
      if (!member.isKind(SymbolKind.EnumField) || !member.declaration) continue; // Ignore non-enum-field members

      const name = member.name;
      if (name !== undefined) {
        const errorNode = member.declaration;

        const firstNode = seen.get(name);
        if (firstNode) {
          errors.push(enumUtils.getFieldDuplicateError(name, firstNode));
          errors.push(enumUtils.getFieldDuplicateError(name, errorNode));
        } else {
          seen.set(name, errorNode);
        }
      }
    }

    return new Report(members, errors);
  },

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Enum)) return Report.create(PASS_THROUGH);

    const declaration = node as ElementDeclarationNode & { type: SyntaxToken };
    const errors = new EnumBinder(compiler, declaration).bind();
    const symbol = compiler.nodeSymbol(node).getFiltered(UNHANDLED);
    if (symbol) errors.push(...compiler.symbolMembers(symbol).getErrors());
    return Report.create(undefined, errors);
  },

  interpretSymbol (compiler: Compiler, symbol: NodeSymbol, filepath?: Filepath): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (!(symbol instanceof EnumSymbol)) return Report.create(PASS_THROUGH);

    const {
      name, schema: schemaName,
    } = symbol.interpretedName(compiler, filepath);

    const fieldSymbols = symbol.members(compiler).filter((m) => m.isKind(SymbolKind.EnumField));
    const values = fieldSymbols.map((f) => {
      const fieldSettings = f.settings(compiler);
      const noteAttr = fieldSettings?.note?.at(0);
      const noteText = noteAttr?.value ? normalizeNote(extractQuotedStringToken(noteAttr.value)!) : undefined;
      return {
        name: f.name ?? '',
        token: f.token!,
        ...(noteText
          ? {
              note: {
                value: noteText,
                token: getTokenPosition(noteAttr!),
              },
            }
          : {}),
      };
    });

    return Report.create({
      name,
      schemaName,
      token: symbol.token!,
      values,
    } as Enum);
  },
};
